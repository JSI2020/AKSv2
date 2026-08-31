"use server";

import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  assets,
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
  sizeBlockRows,
  fitProfiles,
  houseModels,
} from "@aks/db";
import {
  isValidDesignTag,
  RENDER_ANGLES,
  STANDARD_SIZE_LABELS,
  uuidv7,
  type RenderAngle,
} from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { seedRtwStockForDesign } from "@/modules/inventory/rtw-stock";
import { revalidateFabricStockPathsMany } from "@/modules/inventory/revalidate-fabric-paths";
import { revalidateFabricsForDesign } from "./fabric-revalidation";
import { listHouseCollections } from "@/modules/catalog/house-collections-queries";
import { createPresignedReadUrl } from "@/modules/platform/assets";
import { transition } from "@/modules/platform/transition";

import { evaluatePublishChecklist } from "./publish-checklist";
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
  renders: Array<
    typeof designRenders.$inferSelect & { previewUrl: string | null }
  >;
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

  const assetIds = [...new Set(renders.map((r) => r.assetId))];
  const allAssets =
    assetIds.length > 0
      ? await db
          .select({ id: assets.id, r2Key: assets.r2Key })
          .from(assets)
          .where(inArray(assets.id, assetIds))
      : [];

  const urlByAsset = new Map<string, string>();
  await Promise.all(
    allAssets.map(async (a) => {
      try {
        urlByAsset.set(a.id, await createPresignedReadUrl(a.r2Key, 3600));
      } catch {
        /* missing R2 in local */
      }
    }),
  );

  return {
    design: row.design,
    categoryKey: row.categoryKey,
    tags,
    colourways: cws,
    renders: renders.map((r) => ({
      ...r,
      previewUrl: urlByAsset.get(r.assetId) ?? null,
    })),
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
      return { ok: false, error: "Name and article type are required" };
    }

    const [category] = await db
      .select({ key: garmentCategories.key })
      .from(garmentCategories)
      .where(
        and(
          eq(garmentCategories.id, garmentTypeId),
          eq(garmentCategories.active, true),
        ),
      )
      .limit(1);
    if (!category) {
      return { ok: false, error: "Choose a valid article type" };
    }

    const id = uuidv7();
    await db.insert(designs).values({
      id,
      slug,
      name,
      nameUr,
      garmentTypeId,
      components: [category.key],
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
      after: { name, slug, garmentTypeId, components: [category.key] },
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
    const subtitle = String(formData.get("subtitle") ?? "").trim();
    const silhouetteLabel = String(
      formData.get("silhouetteLabel") ?? "",
    ).trim();
    const modelInfo = String(formData.get("modelInfo") ?? "").trim();
    const seoTitle = String(formData.get("seoTitle") ?? "").trim() || null;
    const seoDescription =
      String(formData.get("seoDescription") ?? "").trim() || null;
    const houseDoorTag = String(formData.get("houseDoorTag") ?? "").trim();
    const occasionRaw = String(formData.get("occasionTagsJson") ?? "");
    let occasionTags: string[] | null = null;
    if (occasionRaw) {
      try {
        const parsed = JSON.parse(occasionRaw) as unknown;
        if (!Array.isArray(parsed)) throw new Error("not an array");
        occasionTags = parsed.map((v) => String(v).trim()).filter(Boolean);
        for (const value of occasionTags) {
          if (!isValidDesignTag("OCCASION", value)) {
            return { ok: false, error: `Invalid occasion tag ${value}` };
          }
        }
      } catch {
        return { ok: false, error: "Invalid occasion tags" };
      }
    }
    const componentsRaw = String(formData.get("componentsJson") ?? "[]");

    let componentKeys: string[] = [];
    try {
      const parsed = JSON.parse(componentsRaw) as unknown;
      if (!Array.isArray(parsed) || parsed.length < 1) {
        return { ok: false, error: "Select at least one article type" };
      }
      componentKeys = parsed.map((k) => String(k).trim()).filter(Boolean);
    } catch {
      return { ok: false, error: "Invalid article types" };
    }

    if (!id || !name || componentKeys.length < 1) {
      return { ok: false, error: "Invalid input" };
    }

    const {
      allocateItemNumber,
      isHouseDoorTag,
      itemCodeForHouseTag,
      rebuildItemNumberKeepingQuartet,
    } = await import("./item-number");

    if (houseDoorTag && !(await isHouseDoorTag(houseDoorTag))) {
      return { ok: false, error: "Invalid house door" };
    }

    const cats = await db
      .select({
        id: garmentCategories.id,
        key: garmentCategories.key,
      })
      .from(garmentCategories)
      .where(eq(garmentCategories.active, true));
    const byKey = new Map(cats.map((c) => [c.key, c]));
    for (const key of componentKeys) {
      if (!byKey.has(key)) {
        return { ok: false, error: `Unknown article type: ${key}` };
      }
    }
    const primary = byKey.get(componentKeys[0]!)!;
    const garmentTypeId = primary.id;

    const before = await db
      .select()
      .from(designs)
      .where(eq(designs.id, id))
      .limit(1);
    if (!before[0]) return { ok: false, error: "Not found" };

    let itemNumber = before[0].itemNumber;
    if (houseDoorTag) {
      const itemCode = await itemCodeForHouseTag(houseDoorTag);
      const rebuilt = rebuildItemNumberKeepingQuartet(
        before[0].itemNumber,
        itemCode,
      );
      if (rebuilt) {
        const clash = await db
          .select({ id: designs.id })
          .from(designs)
          .where(eq(designs.itemNumber, rebuilt))
          .limit(1);
        if (clash[0] && clash[0].id !== id) {
          itemNumber = await allocateItemNumber(itemCode, async (c) => {
            const rows = await db
              .select({ id: designs.id })
              .from(designs)
              .where(eq(designs.itemNumber, c))
              .limit(1);
            return Boolean(rows[0] && rows[0].id !== id);
          });
        } else {
          itemNumber = rebuilt;
        }
      } else if (!itemNumber) {
        itemNumber = await allocateItemNumber(itemCode, async (c) => {
          const rows = await db
            .select({ id: designs.id })
            .from(designs)
            .where(eq(designs.itemNumber, c))
            .limit(1);
          return Boolean(rows[0]);
        });
      }
    }

    await db
      .update(designs)
      .set({
        name,
        nameUr,
        description,
        storyCopy,
        subtitle,
        silhouetteLabel,
        modelInfo,
        garmentTypeId,
        components: componentKeys,
        itemNumber,
        seoTitle,
        seoDescription,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, id));

    if (houseDoorTag || occasionTags) {
      const doorTags = new Set(
        (await listHouseCollections({ activeOnly: false })).map((c) => c.tag),
      );
      const existingTags = await db
        .select()
        .from(designTags)
        .where(eq(designTags.designId, id));

      // Rewrite only what this form owns: the house door (a FREE tag) and, when
      // the field was submitted, the OCCASION set. Season and work tags set
      // elsewhere survive untouched.
      const keep = existingTags.filter((t) => {
        if (houseDoorTag && t.kind === "FREE" && doorTags.has(t.value.toUpperCase())) {
          return false;
        }
        if (occasionTags && t.kind === "OCCASION") return false;
        return true;
      });

      await db.delete(designTags).where(eq(designTags.designId, id));
      for (const t of keep) {
        await db.insert(designTags).values({
          designId: id,
          kind: t.kind as "OCCASION" | "SEASON" | "WORK" | "FREE",
          value: t.value,
        });
      }
      if (houseDoorTag) {
        await db.insert(designTags).values({
          designId: id,
          kind: "FREE",
          value: houseDoorTag,
        });
      }
      for (const value of occasionTags ?? []) {
        await db.insert(designTags).values({
          designId: id,
          kind: "OCCASION",
          value,
        });
      }
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.update_details",
      entityType: "design",
      entityId: id,
      before: { name: before[0].name },
      after: { name, garmentTypeId, components: componentKeys, itemNumber },
    });

    revalidatePath(`/admin/designs/${id}`);
    revalidatePath("/admin/designs");
    revalidatePath("/admin/studio");
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
    const compareRaw = String(formData.get("compareAtPriceMinor") ?? "").trim();
    const compareAtPriceMinor =
      compareRaw === ""
        ? null
        : Number.parseInt(compareRaw, 10);

    if (
      !id ||
      !Number.isInteger(basePriceMinor) ||
      !Number.isInteger(madeToMeasureSurchargeMinor) ||
      !Number.isInteger(fabricConsumptionMeters)
    ) {
      return { ok: false, error: "Invalid pricing" };
    }
    if (
      compareAtPriceMinor != null &&
      (!Number.isInteger(compareAtPriceMinor) || compareAtPriceMinor < 0)
    ) {
      return { ok: false, error: "Invalid compare-at price" };
    }

    await db
      .update(designs)
      .set({
        basePriceMinor,
        compareAtPriceMinor,
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
      after: { basePriceMinor, compareAtPriceMinor, fabricConsumptionMeters },
    });

    revalidatePath(`/admin/designs/${id}`);
    revalidatePath("/admin/inventory");
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
    const fitProfilesRaw = String(formData.get("fitProfilesJson") ?? "").trim();
    const fitProfileId = String(formData.get("fitProfileId") ?? "") || null;
    const sizesRaw = String(formData.get("availableSizeLabelsJson") ?? "").trim();
    const pieceBlocksRaw = String(
      formData.get("pieceSizeBlocksJson") ?? "",
    ).trim();

    if (!id) return { ok: false, error: "Invalid input" };

    const design = await db
      .select()
      .from(designs)
      .where(eq(designs.id, id))
      .limit(1);
    if (!design[0]) return { ok: false, error: "Not found" };
    const existingDesign = design[0];

    let fitProfileIds = existingDesign.fitProfileIds ?? {};
    if (fitProfilesRaw) {
      try {
        const parsed = JSON.parse(fitProfilesRaw) as Record<string, string>;
        fitProfileIds = Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => Boolean(v)),
        );
      } catch {
        return { ok: false, error: "Invalid fit profiles" };
      }
    } else if (fitProfileId) {
      const cat = await db
        .select({ key: garmentCategories.key })
        .from(garmentCategories)
        .where(eq(garmentCategories.id, existingDesign.garmentTypeId))
        .limit(1);
      if (cat[0]) fitProfileIds = { [cat[0].key]: fitProfileId };
    }

    let availableSizeLabels = existingDesign.availableSizeLabels ?? [];
    if (sizesRaw) {
      try {
        const parsed = JSON.parse(sizesRaw) as string[];
        availableSizeLabels = parsed.filter((v) =>
          (STANDARD_SIZE_LABELS as readonly string[]).includes(v),
        );
      } catch {
        return { ok: false, error: "Invalid sizes" };
      }
    }

    let pieceSizeBlocks = existingDesign.pieceSizeBlocks ?? {};
    if (pieceBlocksRaw) {
      try {
        const parsed = JSON.parse(pieceBlocksRaw) as Record<string, string>;
        pieceSizeBlocks = Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => Boolean(v)),
        );
      } catch {
        return { ok: false, error: "Invalid piece size blocks" };
      }
    }

    const madeToMeasureOffered =
      String(formData.get("madeToMeasureOffered") ?? "") === "true";

    /** Primary sizeBlockId: first piece fork, else explicit, else existing. */
    const components = existingDesign.components ?? [];
    const primaryKey = components[0];
    const resolvedPrimary =
      (primaryKey ? pieceSizeBlocks[primaryKey] : undefined) ??
      sizeBlockId ??
      existingDesign.sizeBlockId;

    await db.transaction(async (tx) => {
      await tx
        .update(designs)
        .set({
          sizeBlockId: resolvedPrimary,
          pieceSizeBlocks,
          fitProfileIds,
          availableSizeLabels,
          madeToMeasureOffered,
          updatedAt: new Date(),
        })
        .where(eq(designs.id, id));

      if (
        existingDesign.status === "PUBLISHED" ||
        existingDesign.status === "READY_TO_PUBLISH"
      ) {
        await seedRtwStockForDesign(tx as never, id, availableSizeLabels);
      }
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.update_sizing",
      entityType: "design",
      entityId: id,
      before: null,
      after: {
        sizeBlockId: resolvedPrimary,
        pieceSizeBlocks,
        fitProfileIds,
        availableSizeLabels,
        madeToMeasureOffered,
      },
    });

    revalidatePath(`/admin/designs/${id}`);
    revalidatePath("/admin/inventory");
    revalidatePath("/", "layout");
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
    let pieceFabrics: Record<string, string> = {};
    const pieceRaw = String(formData.get("pieceFabricsJson") ?? "").trim();
    if (pieceRaw) {
      try {
        pieceFabrics = JSON.parse(pieceRaw) as Record<string, string>;
      } catch {
        return { ok: false, error: "Invalid piece fabrics" };
      }
    }

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
    let previousFabricId: string | null = null;
    if (existingId) {
      const [prev] = await db
        .select({ fabricId: colourways.fabricId })
        .from(colourways)
        .where(eq(colourways.id, id))
        .limit(1);
      previousFabricId = prev?.fabricId ?? null;
      await db
        .update(colourways)
        .set({
          name,
          nameUr,
          slug,
          fabricId,
          hexApproximation,
          pieceFabrics,
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
        pieceFabrics,
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
    revalidatePath("/admin/inventory");
    revalidateFabricStockPathsMany([
      fabricId,
      ...Object.values(pieceFabrics),
      ...(previousFabricId ? [previousFabricId] : []),
    ]);
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
    const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();
    const sortOrder =
      sortOrderRaw === "" ? Number.NaN : Number.parseInt(sortOrderRaw, 10);

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
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          updatedAt: new Date(),
        })
        .where(eq(designRenders.id, id));
    } else {
      if (angle !== "DETAIL") {
        await db
          .delete(designRenders)
          .where(
            and(
              eq(designRenders.designId, designId),
              eq(designRenders.colourwayId, colourwayId),
              eq(designRenders.angle, angle),
            ),
          );
      }

      let order = sortOrder;
      if (!Number.isFinite(order)) {
        const [maxRow] = await db
          .select({ n: max(designRenders.sortOrder) })
          .from(designRenders)
          .where(
            and(
              eq(designRenders.designId, designId),
              eq(designRenders.colourwayId, colourwayId),
            ),
          );
        order = (maxRow?.n ?? -1) + 1;
      }

      await db.insert(designRenders).values({
        id,
        designId,
        colourwayId,
        angle,
        assetId,
        altText,
        archetypeId,
        isAiGenerated: false,
        sortOrder: order,
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

export async function deleteDesignRender(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const id = String(formData.get("id") ?? "");
    const designId = String(formData.get("designId") ?? "");
    if (!id || !designId) {
      return { ok: false, error: "Invalid render" };
    }

    const [row] = await db
      .select({ id: designRenders.id })
      .from(designRenders)
      .where(
        and(eq(designRenders.id, id), eq(designRenders.designId, designId)),
      )
      .limit(1);
    if (!row) {
      return { ok: false, error: "Photo not found" };
    }

    await db.delete(designRenders).where(eq(designRenders.id, id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.render.delete",
      entityType: "design_render",
      entityId: id,
      before: { designId },
      after: null,
    });

    revalidatePath(`/admin/designs/${designId}`);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed",
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

    let sizeBlockRowCount: number | null = null;
    if (detail.design.sizeBlockId) {
      const sizeRows = await db
        .select({ id: sizeBlockRows.id })
        .from(sizeBlockRows)
        .where(eq(sizeBlockRows.blockId, detail.design.sizeBlockId))
        .limit(1);
      sizeBlockRowCount = sizeRows.length;
    }

    const missing = evaluatePublishChecklist({
      design: detail.design,
      colourways: detail.colourways,
      renders: detail.renders,
      tags: detail.tags,
      sizeBlockRowCount,
    });
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

      const sizeLabels =
        detail.design.availableSizeLabels?.length > 0
          ? detail.design.availableSizeLabels
          : STANDARD_SIZE_LABELS.filter((l) => l !== "XXL");
      await seedRtwStockForDesign(tx as never, id, sizeLabels);
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
    revalidatePath("/admin/studio");
    revalidatePath("/admin/inventory");
    revalidatePath("/", "layout");
    await revalidateFabricsForDesign(id);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Publish failed",
    };
  }
}

/** Take a published design off the storefront (PUBLISHED → DRAFT). */
export async function unpublishDesign(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.publish");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Invalid id" };

    const [row] = await db
      .select({ status: designs.status })
      .from(designs)
      .where(eq(designs.id, id))
      .limit(1);
    if (!row) return { ok: false, error: "Not found" };
    if (row.status !== "PUBLISHED") {
      return { ok: false, error: "Only published designs can be unpublished" };
    }

    await db.transaction(async (tx) => {
      await transition({
        entity: "design",
        id,
        from: "PUBLISHED",
        to: "DRAFT",
        actor: { id: session.user.id, role: session.user.role },
        allowList: DESIGN_TRANSITION_ALLOW,
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.unpublish",
      entityType: "design",
      entityId: id,
      before: { status: "PUBLISHED" },
      after: { status: "DRAFT" },
    });

    revalidatePath(`/admin/designs/${id}`);
    revalidatePath("/admin/designs");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unpublish failed",
    };
  }
}

/** Soft-delete: archive via transition (never hard-delete catalogue rows). */
export async function archiveDesign(
  formData: FormData,
): Promise<DesignActionResult> {
  try {
    const session = await requirePermission("designs.edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Invalid id" };

    const detail = await getDesign(id);
    if (!detail) return { ok: false, error: "Not found" };
    if (detail.design.status === "ARCHIVED") {
      return { ok: true, id };
    }

    const from = detail.design.status;
    await db.transaction(async (tx) => {
      await transition({
        entity: "design",
        id,
        from,
        to: "ARCHIVED",
        actor: { id: session.user.id, role: session.user.role },
        allowList: DESIGN_TRANSITION_ALLOW,
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.archive",
      entityType: "design",
      entityId: id,
      before: { status: from },
      after: { status: "ARCHIVED" },
    });

    revalidatePath(`/admin/designs/${id}`);
    revalidatePath("/admin/designs");
    revalidatePath("/admin/studio");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed",
    };
  }
}

/** Dropdown data for design forms — searchable selects, never free text. */
export async function getDesignFormOptions() {
  await requirePermission("designs.view");
  const { ensureDefaultSizeBlocksForAllCategories } = await import(
    "@/modules/sizing/ensure-default-blocks"
  );
  await ensureDefaultSizeBlocksForAllCategories();

  const [categories, fabricRows, blocks, profiles, archetypes] =
    await Promise.all([
      db
        .select({
          id: garmentCategories.id,
          key: garmentCategories.key,
          name: garmentCategories.name,
          requiresGhostMannequin: garmentCategories.requiresGhostMannequin,
        })
        .from(garmentCategories)
        .where(eq(garmentCategories.active, true))
        .orderBy(asc(garmentCategories.sortOrder)),
      db
        .select({
          id: fabrics.id,
          name: fabrics.name,
          swatchAssetId: fabrics.swatchAssetId,
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
    houseDoors: (await listHouseCollections({ activeOnly: true })).map((c) => ({
      tag: c.tag,
      label: c.navLabel,
      code: c.itemCode,
    })),
  };
}
