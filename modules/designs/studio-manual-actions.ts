"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  colourways,
  db,
  designRenders,
  designs,
  designTags,
  fabrics,
  fitProfiles,
  garmentCategories,
  houseModels,
  insertAuditLog,
  sizeBlocks,
} from "@aks/db";
import {
  DESIGN_TAG_VALUES,
  isValidDesignTag,
  RENDER_ANGLES,
  STANDARD_SIZE_LABELS,
  uuidv7,
  type RenderAngle,
} from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { transition } from "@/modules/platform/transition";

import { evaluatePublishChecklist } from "./publish-checklist";
import { getDesign } from "./actions";
import "./transitions";
import { DESIGN_TRANSITION_ALLOW } from "./transitions";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseIntField(raw: FormDataEntryValue | null, fallback = 0): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isInteger(n) ? n : fallback;
}

/** PKR major units (integer rupees) → paisa. */
function rupeesToPaisa(raw: FormDataEntryValue | null): number {
  const rupees = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isInteger(rupees) || rupees < 0) return -1;
  return rupees * 100;
}

type ColourwayInput = {
  name: string;
  hex: string;
  fabricId: string;
};

type PhotoInput = {
  assetId: string;
  angle: RenderAngle;
  altText: string;
};

function parseColourways(formData: FormData): ColourwayInput[] | { error: string } {
  const raw = String(formData.get("colourwaysJson") ?? "").trim();
  if (!raw) return { error: "Add at least one colour" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid colourways payload" };
  }
  if (!Array.isArray(parsed) || parsed.length < 1) {
    return { error: "Add at least one colour" };
  }
  const out: ColourwayInput[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    const hex = String(r.hex ?? "").trim();
    const fabricId = String(r.fabricId ?? "").trim();
    if (!name || !fabricId) {
      return { error: "Each colour needs a name and fabric" };
    }
    out.push({ name, hex, fabricId });
  }
  if (out.length < 1) return { error: "Add at least one colour" };
  return out;
}

function parsePhotos(formData: FormData): PhotoInput[] | { error: string } {
  const raw = String(formData.get("photosJson") ?? "").trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid photos payload" };
  }
  if (!Array.isArray(parsed)) return { error: "Invalid photos payload" };
  const out: PhotoInput[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const assetId = String(r.assetId ?? "").trim();
    const angle = String(r.angle ?? "FRONT") as RenderAngle;
    const altText = String(r.altText ?? "").trim();
    if (!assetId) continue;
    if (!(RENDER_ANGLES as readonly string[]).includes(angle)) {
      return { error: `Invalid angle: ${angle}` };
    }
    out.push({ assetId, angle, altText });
  }
  return out;
}

function parseAvailableSizes(formData: FormData): {
  labels: string[];
  madeToMeasureOffered: boolean;
} {
  const labels = formData
    .getAll("availableSize")
    .map((v) => String(v).trim())
    .filter((v) =>
      (STANDARD_SIZE_LABELS as readonly string[]).includes(v),
    );
  const madeToMeasureOffered =
    String(formData.get("madeToMeasureOffered") ?? "") === "true";
  return { labels, madeToMeasureOffered };
}

export type StudioFormOptions = {
  categories: { id: string; key: string; name: string }[];
  fabrics: {
    id: string;
    name: string;
    costPerMeterMinor: number;
  }[];
  blocks: { id: string; name: string; categoryId: string }[];
  profiles: { id: string; name: string; categoryId: string }[];
  archetypes: { id: string; name: string }[];
  occasionTags: readonly string[];
  sizeLabels: readonly string[];
};

export async function getStudioFormOptions(): Promise<StudioFormOptions> {
  await requirePermission("designs.view");
  const [categories, fabricRows, blocks, profiles, archetypes] =
    await Promise.all([
      db
        .select({
          id: garmentCategories.id,
          key: garmentCategories.key,
          name: garmentCategories.name,
        })
        .from(garmentCategories)
        .where(eq(garmentCategories.active, true))
        .orderBy(asc(garmentCategories.sortOrder)),
      db
        .select({
          id: fabrics.id,
          name: fabrics.name,
          costPerMeterMinor: fabrics.costPerMeterMinor,
        })
        .from(fabrics)
        .where(eq(fabrics.active, true))
        .orderBy(asc(fabrics.name)),
      db
        .select({
          id: sizeBlocks.id,
          name: sizeBlocks.name,
          categoryId: sizeBlocks.categoryId,
        })
        .from(sizeBlocks)
        .where(and(eq(sizeBlocks.active, true), eq(sizeBlocks.isDefault, true))),
      db
        .select({
          id: fitProfiles.id,
          name: fitProfiles.name,
          categoryId: fitProfiles.categoryId,
        })
        .from(fitProfiles)
        .where(eq(fitProfiles.active, true))
        .orderBy(asc(fitProfiles.sortOrder)),
      db
        .select({ id: houseModels.id, name: houseModels.name })
        .from(houseModels)
        .where(eq(houseModels.active, true)),
    ]);

  return {
    categories,
    fabrics: fabricRows,
    blocks,
    profiles,
    archetypes,
    occasionTags: DESIGN_TAG_VALUES.OCCASION,
    sizeLabels: STANDARD_SIZE_LABELS,
  };
}

export type StudioManualResult =
  | { ok: true; id: string; published: boolean; warning?: string }
  | { ok: false; error: string };

/**
 * Create a manual catalogue design (photos + merchandising — no AI brief).
 * `intent` = "draft" | "publish"
 */
export async function saveManualStudioDesign(
  formData: FormData,
): Promise<StudioManualResult> {
  try {
    const intent = String(formData.get("intent") ?? "draft");
    const publish = intent === "publish";
    const session = await requirePermission(
      publish ? "designs.publish" : "designs.create",
    );
    if (publish) {
      await requirePermission("designs.create");
    }

    const name = String(formData.get("name") ?? "").trim();
    const subtitle = String(formData.get("subtitle") ?? "").trim();
    const description =
      String(formData.get("description") ?? "").trim() || null;
    const garmentTypeId = String(formData.get("garmentTypeId") ?? "").trim();
    const occasionTag = String(formData.get("occasionTag") ?? "").trim();
    const houseModelIds = formData
      .getAll("houseModelId")
      .map((v) => String(v).trim())
      .filter(Boolean);

    const basePriceMinor = rupeesToPaisa(formData.get("basePricePkr"));
    const compareRaw = String(formData.get("compareAtPricePkr") ?? "").trim();
    const compareAtPriceMinor =
      compareRaw === ""
        ? null
        : (() => {
            const p = rupeesToPaisa(compareRaw);
            return p < 0 ? -1 : p;
          })();
    const fabricConsumptionMeters = parseIntField(
      formData.get("fabricConsumptionMeters"),
      0,
    );
    const madeToMeasureSurchargeMinor = rupeesToPaisa(
      formData.get("madeToMeasureSurchargePkr"),
    );
    const mtmSurcharge =
      madeToMeasureSurchargeMinor < 0 ? 0 : madeToMeasureSurchargeMinor;

    const { labels: availableSizeLabels, madeToMeasureOffered } =
      parseAvailableSizes(formData);

    const colourwayInputs = parseColourways(formData);
    if ("error" in colourwayInputs) {
      return { ok: false, error: colourwayInputs.error };
    }
    const photoInputs = parsePhotos(formData);
    if ("error" in photoInputs) {
      return { ok: false, error: photoInputs.error };
    }

    if (!name || !garmentTypeId) {
      return { ok: false, error: "Design name and category are required" };
    }
    if (basePriceMinor < 0) {
      return { ok: false, error: "Price must be a whole number of PKR" };
    }
    if (compareAtPriceMinor === -1) {
      return {
        ok: false,
        error: "Compare-at / offer price must be a whole number of PKR",
      };
    }
    if (
      availableSizeLabels.length < 1 &&
      !madeToMeasureOffered
    ) {
      return {
        ok: false,
        error: "Pick at least one size or offer custom",
      };
    }
    if (occasionTag && !isValidDesignTag("OCCASION", occasionTag)) {
      return { ok: false, error: "Invalid occasion tag" };
    }

    const cat = await db
      .select({ id: garmentCategories.id, key: garmentCategories.key })
      .from(garmentCategories)
      .where(eq(garmentCategories.id, garmentTypeId))
      .limit(1);
    const category = cat[0];
    if (!category) return { ok: false, error: "Category not found" };

    const defaultBlock = await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.categoryId, garmentTypeId),
          eq(sizeBlocks.active, true),
          eq(sizeBlocks.isDefault, true),
        ),
      )
      .limit(1);

    const defaultProfile = await db
      .select({ id: fitProfiles.id })
      .from(fitProfiles)
      .where(
        and(
          eq(fitProfiles.categoryId, garmentTypeId),
          eq(fitProfiles.active, true),
        ),
      )
      .orderBy(asc(fitProfiles.sortOrder))
      .limit(1);

    const archetypeRows =
      houseModelIds.length > 0
        ? await db
            .select({ id: houseModels.id, name: houseModels.name })
            .from(houseModels)
            .where(eq(houseModels.active, true))
        : [];
    const selectedModels = archetypeRows.filter((a) =>
      houseModelIds.includes(a.id),
    );
    const modelInfo = selectedModels.map((m) => m.name).join(" · ");
    const primaryArchetypeId = selectedModels[0]?.id ?? null;

    const slugBase = slugify(name);
    let slug = slugBase || `design-${Date.now()}`;
    const existingSlug = await db
      .select({ id: designs.id })
      .from(designs)
      .where(eq(designs.slug, slug))
      .limit(1);
    if (existingSlug[0]) {
      slug = `${slug}-${uuidv7().slice(0, 8)}`;
    }

    const id = uuidv7();
    const fitProfileIds =
      defaultProfile[0] != null
        ? { [category.key]: defaultProfile[0].id }
        : {};

    await db.transaction(async (tx) => {
      await tx.insert(designs).values({
        id,
        slug,
        name,
        nameUr: "",
        subtitle,
        silhouetteLabel: "",
        modelInfo,
        description,
        status: "DRAFT",
        garmentTypeId,
        components: [category.key],
        sizeBlockId: defaultBlock[0]?.id ?? null,
        availableSizeLabels,
        madeToMeasureOffered,
        fitProfileIds,
        basePriceMinor,
        compareAtPriceMinor,
        madeToMeasureSurchargeMinor: mtmSurcharge,
        fabricConsumptionMeters,
        featured: false,
      });

      if (occasionTag) {
        await tx.insert(designTags).values({
          designId: id,
          kind: "OCCASION",
          value: occasionTag,
        });
      }

      const colourwayIds: string[] = [];
      for (let i = 0; i < colourwayInputs.length; i++) {
        const cw = colourwayInputs[i]!;
        const cwId = uuidv7();
        colourwayIds.push(cwId);
        await tx.insert(colourways).values({
          id: cwId,
          designId: id,
          name: cw.name,
          nameUr: "",
          slug: slugify(cw.name) || `colour-${i + 1}`,
          fabricId: cw.fabricId,
          hexApproximation: cw.hex || null,
          priceDeltaMinor: 0,
          isDefault: i === 0,
          sortOrder: i,
          active: true,
        });
      }

      const defaultCwId = colourwayIds[0]!;
      for (let i = 0; i < photoInputs.length; i++) {
        const photo = photoInputs[i]!;
        await tx.insert(designRenders).values({
          id: uuidv7(),
          designId: id,
          colourwayId: defaultCwId,
          angle: photo.angle,
          archetypeId: primaryArchetypeId,
          assetId: photo.assetId,
          isAiGenerated: false,
          altText: photo.altText || `${name} · ${photo.angle}`,
          sortOrder: i,
        });
      }
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.studio_manual.create",
      entityType: "design",
      entityId: id,
      before: null,
      after: {
        name,
        slug,
        garmentTypeId,
        colourways: colourwayInputs.length,
        photos: photoInputs.length,
      },
    });

    if (publish) {
      const detail = await getDesign(id);
      if (!detail) return { ok: false, error: "Created but not found" };
      const missing = evaluatePublishChecklist({
        design: detail.design,
        colourways: detail.colourways,
        renders: detail.renders,
        tags: detail.tags,
      });
      if (missing.length) {
        revalidatePath("/admin/studio");
        revalidatePath("/admin/designs");
        revalidatePath(`/admin/designs/${id}`);
        return {
          ok: true,
          id,
          published: false,
          warning: `Saved as draft. Publish checklist: ${missing.join("; ")}`,
        };
      }

      await db.transaction(async (tx) => {
        await transition({
          entity: "design",
          id,
          from: "DRAFT",
          to: "PUBLISHED",
          actor: { id: session.user.id, role: session.user.role },
          allowList: DESIGN_TRANSITION_ALLOW,
          tx: tx as never,
        });
      });

      await insertAuditLog(db, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "design.publish",
        entityType: "design",
        entityId: id,
        before: { status: "DRAFT" },
        after: { status: "PUBLISHED", source: "studio_manual" },
      });
    }

    revalidatePath("/admin/studio");
    revalidatePath("/admin/designs");
    revalidatePath(`/admin/designs/${id}`);
    return { ok: true, id, published: publish };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}
