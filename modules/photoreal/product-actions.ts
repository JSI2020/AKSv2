"use server";

import { and, asc, eq, ilike, inArray, ne } from "drizzle-orm";

import {
  colourways,
  db,
  designRenders,
  designs,
  insertAuditLog,
} from "@aks/db";
import { uuidv7, type RenderAngle } from "@aks/shared";
import { completeUpload, uploadBufferToR2 } from "@/modules/platform/assets";

/**
 * AI Studio → catalogue. Lets the team pick a design and send favourite
 * renders straight into its product photos (design_renders), instead of a
 * separate gallery nobody links to the shop.
 */

type ActionError = { ok: false; error: string };

export type StudioDesignOption = {
  id: string;
  name: string;
  status: string;
  colourways: Array<{ id: string; name: string; isDefault: boolean }>;
};

async function requireDesignEdit() {
  const { requirePermission } = await import("@/modules/auth");
  return requirePermission("designs.edit");
}

/** Designs for the "Add to product" picker — search by name, newest first. */
export async function listStudioDesignOptionsAction(
  query: string,
): Promise<{ ok: true; designs: StudioDesignOption[] } | ActionError> {
  try {
    await requireDesignEdit();
    const q = query.trim();
    const rows = await db
      .select({ id: designs.id, name: designs.name, status: designs.status })
      .from(designs)
      .where(
        and(
          ne(designs.status, "ARCHIVED"),
          q ? ilike(designs.name, `%${q.replace(/[%_]/g, "")}%`) : undefined,
        ),
      )
      .orderBy(asc(designs.name))
      .limit(30);

    const ids = rows.map((r) => r.id);
    const cws = ids.length
      ? await db
          .select({
            id: colourways.id,
            designId: colourways.designId,
            name: colourways.name,
            isDefault: colourways.isDefault,
          })
          .from(colourways)
          .where(and(inArray(colourways.designId, ids), eq(colourways.active, true)))
          .orderBy(asc(colourways.sortOrder))
      : [];

    return {
      ok: true,
      designs: rows.map((r) => ({
        ...r,
        colourways: cws
          .filter((c) => c.designId === r.id)
          .map(({ id, name, isDefault }) => ({ id, name, isDefault })),
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not load designs.",
    };
  }
}

const SLOT_ANGLE = {
  front: "FRONT",
  second: "THREE_QUARTER",
  back: "BACK",
} as const satisfies Record<string, RenderAngle>;

export type ProductPhotoSlot = keyof typeof SLOT_ANGLE;

const SLOT_LABEL: Record<ProductPhotoSlot, string> = {
  front: "Front",
  second: "Three-quarter",
  back: "Back",
};

function isFalCdn(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && (host === "fal.media" || host.endsWith(".fal.media"));
}

/**
 * Store each chosen render as an asset and attach it to the design's colour
 * as its Front / Second / Back photo. Earlier AI photos in that slot are
 * replaced; real (non-AI) photos are never touched and still take priority
 * on the storefront.
 */
export async function addPhotosToProductAction(input: {
  designId: string;
  colourwayId: string;
  photos: Array<{ imageUrl: string; slot: ProductPhotoSlot }>;
}): Promise<{ ok: true; added: number } | ActionError> {
  try {
    const session = await requireDesignEdit();

    const photos = input.photos.filter((p) => p.slot in SLOT_ANGLE);
    if (!photos.length) return { ok: false, error: "Pick at least one photo." };
    const slots = photos.map((p) => p.slot);
    if (new Set(slots).size !== slots.length) {
      return { ok: false, error: "Each photo needs its own slot (Front, Second, Back)." };
    }

    const [design] = await db
      .select({ id: designs.id, name: designs.name })
      .from(designs)
      .where(eq(designs.id, input.designId))
      .limit(1);
    const [cw] = await db
      .select({ id: colourways.id, name: colourways.name })
      .from(colourways)
      .where(
        and(
          eq(colourways.id, input.colourwayId),
          eq(colourways.designId, input.designId),
        ),
      )
      .limit(1);
    if (!design || !cw) return { ok: false, error: "Design or colour not found." };

    // Download + store first, so a failed fetch never leaves a slot emptied.
    const stored: Array<{ assetId: string; slot: ProductPhotoSlot }> = [];
    for (const photo of photos) {
      let url: URL;
      try {
        url = new URL(photo.imageUrl);
      } catch {
        return { ok: false, error: "Invalid image address." };
      }
      if (!isFalCdn(url)) return { ok: false, error: "Only AI Studio renders can be added." };

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const mime = res.headers.get("content-type") ?? "";
      if (!res.ok || !mime.startsWith("image/")) {
        return { ok: false, error: "Could not download one of the photos — try again." };
      }
      const body = Buffer.from(await res.arrayBuffer());
      const { key } = await uploadBufferToR2({
        body,
        mime,
        keyPrefix: "studio-renders",
      });
      const asset = await completeUpload({
        key,
        mime,
        isAiGenerated: true,
        uploadedById: session.user.id,
      });
      stored.push({ assetId: asset.id, slot: photo.slot });
    }

    await db.transaction(async (tx) => {
      for (const { assetId, slot } of stored) {
        const angle = SLOT_ANGLE[slot];
        await tx
          .delete(designRenders)
          .where(
            and(
              eq(designRenders.designId, design.id),
              eq(designRenders.colourwayId, cw.id),
              eq(designRenders.angle, angle),
              eq(designRenders.isAiGenerated, true),
            ),
          );
        await tx.insert(designRenders).values({
          id: uuidv7(),
          designId: design.id,
          colourwayId: cw.id,
          angle,
          assetId,
          isAiGenerated: true,
          altText: `${design.name} — ${cw.name} — ${SLOT_LABEL[slot]}`,
          sortOrder: 0,
        });
      }
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role ?? null,
      action: "photoreal.add_to_product",
      entityType: "design",
      entityId: design.id,
      before: null,
      after: {
        colourwayId: cw.id,
        slots: stored.map((s) => s.slot),
        assetIds: stored.map((s) => s.assetId),
      },
    });

    return { ok: true, added: stored.length };
  } catch (err) {
    console.error("[photoreal/add-to-product]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not add photos.",
    };
  }
}
