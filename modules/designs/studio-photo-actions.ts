"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  colourways,
  db,
  designRenders,
  designs,
  fabrics,
  insertAuditLog,
} from "@aks/db";
import { RENDER_ANGLES, uuidv7, type RenderAngle } from "@aks/shared";
import { generateColourways } from "@/modules/ai/studio/colourway-actions";
import { requirePermission } from "@/modules/auth";
import {
  poseById,
  resolveStudioPosePicks,
} from "@/modules/photoreal/commercial-poses";

type DesignActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function isValidAngleOrPose(value: string): boolean {
  if ((RENDER_ANGLES as readonly string[]).includes(value)) return true;
  return Boolean(poseById(value));
}

export async function saveStudioAnglePicks(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const id = String(formData.get("id") ?? "");
    const raw = String(formData.get("anglesJson") ?? "[]");
    let picks: string[];
    try {
      picks = JSON.parse(raw) as string[];
    } catch {
      return { ok: false, error: "Invalid angles" };
    }
    if (!id || !Array.isArray(picks) || picks.length !== 3) {
      return { ok: false, error: "Pick exactly three angles" };
    }
    for (const a of picks) {
      if (!isValidAngleOrPose(a)) {
        return { ok: false, error: `Invalid angle ${a}` };
      }
    }

    const normalised = resolveStudioPosePicks(picks).map((p) => p.id);

    await db
      .update(designs)
      .set({ studioAnglePicks: normalised, updatedAt: new Date() })
      .where(eq(designs.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.studio_angles.save",
      entityType: "design",
      entityId: id,
      before: null,
      after: { studioAnglePicks: normalised },
    });

    revalidatePath(`/admin/designs/${id}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save angles failed",
    };
  }
}

/**
 * Replace colourways from Photos tab fabric selections.
 * Input: [{ name, fabricId, hex?, pieceFabrics? }]
 */
export async function syncStudioColourways(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const designId = String(formData.get("designId") ?? "");
    const raw = String(formData.get("colourwaysJson") ?? "[]");
    let rows: {
      name: string;
      fabricId: string;
      hex?: string;
      pieceFabrics?: Record<string, string>;
    }[];
    try {
      rows = JSON.parse(raw) as typeof rows;
    } catch {
      return { ok: false, error: "Invalid colourways" };
    }
    if (!designId || !Array.isArray(rows) || rows.length < 1) {
      return { ok: false, error: "Add at least one colour / fabric" };
    }

    for (const row of rows) {
      if (!row.name?.trim() || !row.fabricId) {
        return { ok: false, error: "Each colour needs a name and fabric" };
      }
    }

    const existing = await db
      .select({ id: colourways.id })
      .from(colourways)
      .where(eq(colourways.designId, designId));

    // Keep renders only when colourway ids are preserved — full replace drops renders.
    await db.delete(colourways).where(eq(colourways.designId, designId));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      await db.insert(colourways).values({
        id: uuidv7(),
        designId,
        name: row.name.trim(),
        nameUr: "",
        slug: slugify(row.name) || `colour-${i + 1}`,
        fabricId: row.fabricId,
        hexApproximation: row.hex?.trim() || null,
        pieceFabrics: row.pieceFabrics ?? {},
        priceDeltaMinor: 0,
        isDefault: i === 0,
        sortOrder: i,
        active: true,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.studio_colourways.sync",
      entityType: "design",
      entityId: designId,
      before: { count: existing.length },
      after: { count: rows.length },
    });

    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, id: designId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Colour sync failed",
    };
  }
}

export async function generateStudioAngles(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    await requirePermission("designs.create");
    const designId = String(formData.get("designId") ?? "");
    if (!designId) return { ok: false, error: "Invalid design" };

    const slotRaw = String(formData.get("slotIndex") ?? "").trim();
    const poseIdRaw = String(formData.get("poseId") ?? "").trim();
    const anglesRaw = String(formData.get("anglesJson") ?? "").trim();

    let picks = resolveStudioPosePicks(
      (await db
        .select({ studioAnglePicks: designs.studioAnglePicks })
        .from(designs)
        .where(eq(designs.id, designId))
        .limit(1))[0]?.studioAnglePicks ?? null,
    ).map((p) => p.id);

    if (anglesRaw) {
      try {
        const parsed = JSON.parse(anglesRaw) as string[];
        if (parsed.length === 3) {
          picks = resolveStudioPosePicks(parsed).map((p) => p.id);
        }
      } catch {
        return { ok: false, error: "Invalid angles" };
      }
    }

    const slotIndex = slotRaw === "" ? null : Number.parseInt(slotRaw, 10);
    if (slotIndex != null) {
      if (![0, 1, 2].includes(slotIndex)) {
        return { ok: false, error: "Invalid angle slot" };
      }
      if (poseIdRaw && poseById(poseIdRaw)) {
        picks[slotIndex] = poseIdRaw;
      }
    }

    await db
      .update(designs)
      .set({ studioAnglePicks: picks, updatedAt: new Date() })
      .where(eq(designs.id, designId));

    // Ensure at least one colourway exists for generation.
    const existingCw = await db
      .select({ id: colourways.id })
      .from(colourways)
      .where(eq(colourways.designId, designId))
      .limit(1);
    if (!existingCw[0]) {
      const [fabric] = await db
        .select({ id: fabrics.id, name: fabrics.name })
        .from(fabrics)
        .where(eq(fabrics.active, true))
        .limit(1);
      if (!fabric) {
        return { ok: false, error: "Add a fabric and colour set before generating." };
      }
      await db.insert(colourways).values({
        id: uuidv7(),
        designId,
        name: fabric.name,
        slug: slugify(fabric.name) || "default",
        fabricId: fabric.id,
        isDefault: true,
        sortOrder: 0,
        active: true,
      });
    }

    const poses = resolveStudioPosePicks(picks);
    const SLOT_CAMERAS = ["FRONT", "THREE_QUARTER", "BACK"] as const;
    const single =
      slotIndex != null ? poses[slotIndex]! : null;
    const singleAngle =
      slotIndex != null ? SLOT_CAMERAS[slotIndex]! : undefined;

    const res = await generateColourways({
      designId,
      manualStudio: true,
      includeDefault: true,
      angles: singleAngle ? [singleAngle] : undefined,
      posePrompt: single?.prompt ?? null,
    });
    if (!res.ok) return { ok: false, error: res.error };
    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, id: designId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Generate failed",
    };
  }
}

export async function attachReferencePhoto(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const designId = String(formData.get("designId") ?? "");
    const assetId = String(formData.get("assetId") ?? "");
    const altText = String(formData.get("altText") ?? "").trim() || "Reference";
    const angle = (String(formData.get("angle") ?? "FRONT") ||
      "FRONT") as RenderAngle;

    if (!designId || !assetId) {
      return { ok: false, error: "Photo and design required" };
    }

    let [cw] = await db
      .select()
      .from(colourways)
      .where(
        and(eq(colourways.designId, designId), eq(colourways.isDefault, true)),
      )
      .limit(1);

    if (!cw) {
      const [anyCw] = await db
        .select()
        .from(colourways)
        .where(eq(colourways.designId, designId))
        .limit(1);
      cw = anyCw;
    }

    if (!cw) {
      const [fabric] = await db
        .select({ id: fabrics.id })
        .from(fabrics)
        .where(eq(fabrics.active, true))
        .limit(1);
      if (!fabric) return { ok: false, error: "Add a fabric first" };
      const cwId = uuidv7();
      await db.insert(colourways).values({
        id: cwId,
        designId,
        name: "Default",
        slug: "default",
        fabricId: fabric.id,
        isDefault: true,
        sortOrder: 0,
        active: true,
      });
      [cw] = await db
        .select()
        .from(colourways)
        .where(eq(colourways.id, cwId))
        .limit(1);
    }

    if (!cw) return { ok: false, error: "Could not resolve colourway" };

    // Replace prior FRONT reference so generate always finds one.
    if (angle === "FRONT") {
      await db
        .delete(designRenders)
        .where(
          and(
            eq(designRenders.designId, designId),
            eq(designRenders.angle, "FRONT"),
            eq(designRenders.isAiGenerated, false),
          ),
        );
    }

    const id = uuidv7();
    await db.insert(designRenders).values({
      id,
      designId,
      colourwayId: cw.id,
      angle,
      assetId,
      isAiGenerated: false,
      altText,
      sortOrder: 0,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.reference_photo.attach",
      entityType: "design_render",
      entityId: id,
      before: null,
      after: { designId, angle, assetId },
    });

    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Attach failed",
    };
  }
}
