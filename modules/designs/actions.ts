"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  colourways,
  db,
  designRenders,
  designs,
  designTags,
  customizationOptions,
  customizationOptionValues,
  fabrics,
  garmentCategories,
  insertAuditLog,
  sizeBlocks,
  fitProfiles,
  houseModels,
} from "@aks/db";
import {
  isValidDesignTag,
  RENDER_ANGLES,
  uuidv7,
  type RenderAngle,
} from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { transition } from "@/modules/platform/transition";

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

export type DesignListItem = {
  id: string;
  slug: string;
  name: string;
  status: string;
  basePriceMinor: number;
  categoryKey: string;
  featured: boolean;
  updatedAt: Date;
};

export async function listDesigns(): Promise<DesignListItem[]> {
  await requirePermission("designs.view");
  const rows = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      name: designs.name,
      status: designs.status,
      basePriceMinor: designs.basePriceMinor,
      categoryKey: garmentCategories.key,
      featured: designs.featured,
      updatedAt: designs.updatedAt,
    })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .orderBy(desc(designs.updatedAt));
  return rows;
}

export type DesignDetail = {
  design: typeof designs.$inferSelect;
  categoryKey: string;
  tags: { kind: string; value: string }[];
  colourways: (typeof colourways.$inferSelect)[];
  renders: (typeof designRenders.$inferSelect)[];
  options: {
    option: typeof customizationOptions.$inferSelect;
    values: (typeof customizationOptionValues.$inferSelect)[];
  }[];
};

export async function getDesign(id: string): Promise<DesignDetail | null> {
  await requirePermission("designs.view");
  const rows = await db
    .select({
      design: designs,
      categoryKey: garmentCategories.key,
    })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .where(eq(designs.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [tags, cws, renders, opts] = await Promise.all([
    db.select().from(designTags).where(eq(designTags.designId, id)),
    db
      .select()
      .from(colourways)
      .where(eq(colourways.designId, id))
      .orderBy(asc(colourways.sortOrder)),
    db
      .select()
      .from(designRenders)
      .where(eq(designRenders.designId, id))
      .orderBy(asc(designRenders.sortOrder)),
    db
      .select()
      .from(customizationOptions)
      .where(eq(customizationOptions.designId, id))
      .orderBy(asc(customizationOptions.sortOrder)),
  ]);

  const options = [];
  for (const option of opts) {
    const values = await db
      .select()
      .from(customizationOptionValues)
      .where(eq(customizationOptionValues.optionId, option.id))
      .orderBy(asc(customizationOptionValues.sortOrder));
    options.push({ option, values });
  }

  return {
    design: row.design,
    categoryKey: row.categoryKey,
    tags,
    colourways: cws,
    renders,
    options,
  };
}

export type DesignActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createDesign(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.create");
    const name = String(formData.get("name") ?? "").trim();
    const nameUr = String(formData.get("nameUr") ?? "").trim();
    const garmentTypeId = String(formData.get("garmentTypeId") ?? "");
    const slugRaw = String(formData.get("slug") ?? "").trim();
    const slug = slugify(slugRaw || name);

    if (!name || !garmentTypeId || !slug) {
      return { ok: false, error: "Name and category are required" };
    }

    const id = uuidv7();
    await db.insert(designs).values({
      id,
      slug,
      name,
      nameUr,
      garmentTypeId,
      components: [],
      status: "DRAFT",
      basePriceMinor: 0,
      madeToMeasureSurchargeMinor: 0,
      fabricConsumptionMeters: 0,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.create",
      entityType: "design",
      entityId: id,
      before: null,
      after: { name, slug, garmentTypeId },
    });

    revalidatePath("/admin/designs");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create failed",
    };
  }
}

export async function updateDesignDetails(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const nameUr = String(formData.get("nameUr") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const storyCopy = String(formData.get("storyCopy") ?? "").trim() || null;
    const garmentTypeId = String(formData.get("garmentTypeId") ?? "");
    const featured = String(formData.get("featured") ?? "") === "true";
    const seoTitle = String(formData.get("seoTitle") ?? "").trim() || null;
    const seoDescription =
      String(formData.get("seoDescription") ?? "").trim() || null;

    if (!id || !name || !garmentTypeId) {
      return { ok: false, error: "Invalid input" };
    }

    const before = await db
      .select()
      .from(designs)
      .where(eq(designs.id, id))
      .limit(1);
    if (!before[0]) return { ok: false, error: "Not found" };

    await db
      .update(designs)
      .set({
        name,
        nameUr,
        description,
        storyCopy,
        garmentTypeId,
        featured,
        seoTitle,
        seoDescription,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.update_details",
      entityType: "design",
      entityId: id,
      before: { name: before[0].name },
      after: { name, garmentTypeId, featured },
    });

    revalidatePath(`/admin/designs/${id}`);
    revalidatePath("/admin/designs");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}

export async function updateDesignPricing(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const id = String(formData.get("id") ?? "");
    const basePriceMinor = Number.parseInt(
      String(formData.get("basePriceMinor") ?? ""),
      10,
    );
    const madeToMeasureSurchargeMinor = Number.parseInt(
      String(formData.get("madeToMeasureSurchargeMinor") ?? "0"),
      10,
    );
    const fabricConsumptionMeters = Number.parseInt(
      String(formData.get("fabricConsumptionMeters") ?? "0"),
      10,
    );
    const leadRaw = String(formData.get("leadTimeDaysOverride") ?? "").trim();
    const leadTimeDaysOverride = leadRaw
      ? Number.parseInt(leadRaw, 10)
      : null;

    if (
      !id ||
      !Number.isInteger(basePriceMinor) ||
      !Number.isInteger(madeToMeasureSurchargeMinor) ||
      !Number.isInteger(fabricConsumptionMeters)
    ) {
      return { ok: false, error: "Invalid pricing" };
    }

    await db
      .update(designs)
      .set({
        basePriceMinor,
        madeToMeasureSurchargeMinor,
        fabricConsumptionMeters,
        leadTimeDaysOverride,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.update_pricing",
      entityType: "design",
      entityId: id,
      before: null,
      after: { basePriceMinor, fabricConsumptionMeters },
    });

    revalidatePath(`/admin/designs/${id}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Pricing update failed",
    };
  }
}

export async function updateDesignSizing(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const id = String(formData.get("id") ?? "");
    const sizeBlockId = String(formData.get("sizeBlockId") ?? "") || null;
    const fitProfileId = String(formData.get("fitProfileId") ?? "") || null;

    if (!id) return { ok: false, error: "Invalid input" };

    const design = await db
      .select()
      .from(designs)
      .where(eq(designs.id, id))
      .limit(1);
    if (!design[0]) return { ok: false, error: "Not found" };

    const cat = await db
      .select({ key: garmentCategories.key })
      .from(garmentCategories)
      .where(eq(garmentCategories.id, design[0].garmentTypeId))
      .limit(1);

    const fitProfileIds =
      fitProfileId && cat[0]
        ? { [cat[0].key]: fitProfileId }
        : design[0].fitProfileIds;

    await db
      .update(designs)
      .set({
        sizeBlockId,
        fitProfileIds,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.update_sizing",
      entityType: "design",
      entityId: id,
      before: null,
      after: { sizeBlockId, fitProfileIds },
    });

    revalidatePath(`/admin/designs/${id}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sizing update failed",
    };
  }
}

export async function setDesignTags(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const id = String(formData.get("id") ?? "");
    const raw = String(formData.get("tags") ?? "[]");
    let parsed: { kind: string; value: string }[];
    try {
      parsed = JSON.parse(raw) as { kind: string; value: string }[];
    } catch {
      return { ok: false, error: "Invalid tags JSON" };
    }
    if (!id || !Array.isArray(parsed)) {
      return { ok: false, error: "Invalid input" };
    }

    for (const t of parsed) {
      if (!isValidDesignTag(t.kind, t.value)) {
        return { ok: false, error: `Invalid tag ${t.kind}:${t.value}` };
      }
    }

    await db.delete(designTags).where(eq(designTags.designId, id));
    for (const t of parsed) {
      await db.insert(designTags).values({
        designId: id,
        kind: t.kind as "OCCASION" | "SEASON" | "WORK" | "FREE",
        value: t.value,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.set_tags",
      entityType: "design",
      entityId: id,
      before: null,
      after: { tags: parsed },
    });

    revalidatePath(`/admin/designs/${id}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Tags update failed",
    };
  }
}

export async function upsertColourway(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const designId = String(formData.get("designId") ?? "");
    const existingId = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const nameUr = String(formData.get("nameUr") ?? "").trim();
    const fabricId = String(formData.get("fabricId") ?? "");
    const hexApproximation =
      String(formData.get("hexApproximation") ?? "").trim() || null;
    const priceDeltaMinor = Number.parseInt(
      String(formData.get("priceDeltaMinor") ?? "0"),
      10,
    );
    const isDefault = String(formData.get("isDefault") ?? "") === "true";
    const sortOrder = Number.parseInt(
      String(formData.get("sortOrder") ?? "0"),
      10,
    );
    const slug = slugify(
      String(formData.get("slug") ?? "").trim() || name,
    );

    if (!designId || !name || !fabricId || !Number.isInteger(priceDeltaMinor)) {
      return { ok: false, error: "Invalid colourway" };
    }

    if (isDefault) {
      await db
        .update(colourways)
        .set({ isDefault: false })
        .where(eq(colourways.designId, designId));
    }

    const id = existingId || uuidv7();
    if (existingId) {
      await db
        .update(colourways)
        .set({
          name,
          nameUr,
          slug,
          fabricId,
          hexApproximation,
          priceDeltaMinor,
          isDefault,
          sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(colourways.id, id));
    } else {
      await db.insert(colourways).values({
        id,
        designId,
        name,
        nameUr,
        slug,
        fabricId,
        hexApproximation,
        priceDeltaMinor,
        isDefault,
        sortOrder,
        active: true,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: existingId ? "design.colourway.update" : "design.colourway.create",
      entityType: "colourway",
      entityId: id,
      before: null,
      after: { designId, name, fabricId },
    });

    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Colourway save failed",
    };
  }
}

export async function upsertDesignRender(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const designId = String(formData.get("designId") ?? "");
    const colourwayId = String(formData.get("colourwayId") ?? "");
    const angle = String(formData.get("angle") ?? "") as RenderAngle;
    const assetId = String(formData.get("assetId") ?? "");
    const altText = String(formData.get("altText") ?? "").trim();
    const archetypeId =
      String(formData.get("archetypeId") ?? "").trim() || null;
    const existingId = String(formData.get("id") ?? "");
    const sortOrder = Number.parseInt(
      String(formData.get("sortOrder") ?? "0"),
      10,
    );

    if (
      !designId ||
      !colourwayId ||
      !assetId ||
      !(RENDER_ANGLES as readonly string[]).includes(angle)
    ) {
      return { ok: false, error: "Invalid render" };
    }

    const id = existingId || uuidv7();
    if (existingId) {
      await db
        .update(designRenders)
        .set({
          angle,
          assetId,
          altText,
          archetypeId,
          sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(designRenders.id, id));
    } else {
      await db.insert(designRenders).values({
        id,
        designId,
        colourwayId,
        angle,
        assetId,
        altText,
        archetypeId,
        isAiGenerated: false,
        sortOrder,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.render.upsert",
      entityType: "design_render",
      entityId: id,
      before: null,
      after: { colourwayId, angle, assetId, altText },
    });

    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Render save failed",
    };
  }
}

export async function upsertCustomizationOption(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const designId = String(formData.get("designId") ?? "");
    const key = String(formData.get("key") ?? "").trim().toUpperCase();
    const label = String(formData.get("label") ?? "").trim();
    const labelUr = String(formData.get("labelUr") ?? "").trim();
    const inputType = String(formData.get("inputType") ?? "SELECT") as
      | "SELECT"
      | "BOOLEAN";
    const required = String(formData.get("required") ?? "") === "true";
    const existingId = String(formData.get("id") ?? "");

    if (!designId || !key || !label) {
      return { ok: false, error: "Invalid option" };
    }

    const id = existingId || uuidv7();
    if (existingId) {
      await db
        .update(customizationOptions)
        .set({
          key,
          label,
          labelUr,
          inputType,
          required,
          updatedAt: new Date(),
        })
        .where(eq(customizationOptions.id, id));
    } else {
      await db.insert(customizationOptions).values({
        id,
        designId,
        key,
        label,
        labelUr,
        inputType,
        required,
        sortOrder: 0,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.customization.upsert",
      entityType: "customization_option",
      entityId: id,
      before: null,
      after: { designId, key, label },
    });

    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Option save failed",
    };
  }
}

export async function addCustomizationValue(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const optionId = String(formData.get("optionId") ?? "");
    const designId = String(formData.get("designId") ?? "");
    const value = String(formData.get("value") ?? "").trim();
    const label = String(formData.get("label") ?? "").trim();
    const priceDeltaMinor = Number.parseInt(
      String(formData.get("priceDeltaMinor") ?? "0"),
      10,
    );

    if (!optionId || !value || !label || !Number.isInteger(priceDeltaMinor)) {
      return { ok: false, error: "Invalid value" };
    }

    const id = uuidv7();
    await db.insert(customizationOptionValues).values({
      id,
      optionId,
      value,
      label,
      labelUr: "",
      priceDeltaMinor,
      sortOrder: 0,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.customization_value.create",
      entityType: "customization_option_value",
      entityId: id,
      before: null,
      after: { optionId, value, priceDeltaMinor },
    });

    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Value save failed",
    };
  }
}

export async function publishDesign(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.publish");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Invalid id" };

    const detail = await getDesign(id);
    if (!detail) return { ok: false, error: "Not found" };

    const missing: string[] = [];
    if (detail.colourways.length < 1) missing.push("≥1 colourway");
    for (const cw of detail.colourways) {
      const cwRenders = detail.renders.filter((r) => r.colourwayId === cw.id);
      if (cwRenders.length < 1) missing.push(`render for ${cw.name}`);
      for (const r of cwRenders) {
        if (!r.altText.trim()) missing.push(`alt text on ${cw.name}/${r.angle}`);
      }
    }
    if (detail.design.basePriceMinor <= 0) missing.push("base price");
    if (detail.design.fabricConsumptionMeters <= 0) {
      missing.push("fabric consumption");
    }
    if (!detail.design.sizeBlockId) missing.push("size block");
    if (Object.keys(detail.design.fitProfileIds ?? {}).length < 1) {
      missing.push("fit profile");
    }
    if (!detail.tags.some((t) => t.kind === "OCCASION")) {
      missing.push("≥1 occasion tag");
    }
    if (missing.length) {
      return {
        ok: false,
        error: `Publish checklist: ${missing.join("; ")}`,
      };
    }

    const publishFrom = detail.design.status;
    const publishTo = "PUBLISHED" as const;
    const allowedFrom = [publishFrom, "READY_TO_PUBLISH"] as const;
    if (!allowedFrom.includes(publishFrom as (typeof allowedFrom)[number])) {
      return {
        ok: false,
        error: `Design must be DRAFT or READY_TO_PUBLISH to publish (current: ${detail.design.status}).`,
      };
    }

    await db.transaction(async (tx) => {
      await transition({
        entity: "design",
        id,
        from: publishFrom,
        to: publishTo,
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
      before: { status: detail.design.status },
      after: { status: "PUBLISHED" },
    });

    revalidatePath(`/admin/designs/${id}`);
    revalidatePath("/admin/designs");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Publish failed",
    };
  }
}

/** Dropdown data for design forms — searchable selects, never free text. */
export async function getDesignFormOptions() {
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
        .select({ id: fabrics.id, name: fabrics.name })
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

  return { categories, fabrics: fabricRows, blocks, profiles, archetypes };
}
