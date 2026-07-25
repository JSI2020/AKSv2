import { and, asc, eq, isNotNull } from "drizzle-orm";

import {
  assets,
  colourways,
  customizationOptionValues,
  customizationOptions,
  db,
  designRenders,
  designs,
  designTags,
  fabrics,
  garmentCategories,
  houseModels,
} from "@aks/db";
import { formatModelDisclosure } from "@aks/shared";

import { createPresignedReadUrl } from "@/modules/platform/assets/r2";

import type { DesignDetailPublic } from "./types";
import { tagValueToCollectionSlug, titleFromTagValue } from "./types";

export async function getDesignBySlug(
  slug: string,
): Promise<DesignDetailPublic | null> {
  const rows = await db
    .select({
      design: designs,
      garmentCategory: {
        id: garmentCategories.id,
        key: garmentCategories.key,
        name: garmentCategories.name,
      },
    })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .where(and(eq(designs.slug, slug), eq(designs.status, "PUBLISHED")))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const designId = row.design.id;

  const [tags, cwRows, opts, renderArchetypes] = await Promise.all([
    db.select().from(designTags).where(eq(designTags.designId, designId)),
    db
      .select({
        colourway: colourways,
        fabricName: fabrics.name,
        fabricId: fabrics.id,
        swatchAssetId: fabrics.swatchAssetId,
        swatchR2Key: assets.r2Key,
      })
      .from(colourways)
      .innerJoin(fabrics, eq(colourways.fabricId, fabrics.id))
      .leftJoin(assets, eq(fabrics.swatchAssetId, assets.id))
      .where(and(eq(colourways.designId, designId), eq(colourways.active, true)))
      .orderBy(asc(colourways.sortOrder)),
    db
      .select()
      .from(customizationOptions)
      .where(eq(customizationOptions.designId, designId))
      .orderBy(asc(customizationOptions.sortOrder)),
    db
      .selectDistinct({ archetypeId: designRenders.archetypeId })
      .from(designRenders)
      .where(
        and(
          eq(designRenders.designId, designId),
          isNotNull(designRenders.archetypeId),
        ),
      ),
  ]);

  const optionValues = await Promise.all(
    opts.map(async (option) => {
      const values = await db
        .select()
        .from(customizationOptionValues)
        .where(eq(customizationOptionValues.optionId, option.id))
        .orderBy(asc(customizationOptionValues.sortOrder));
      return { option, values };
    }),
  );

  const colourwaysPublic = await Promise.all(
    cwRows.map(async (cw) => {
      let swatchUrl: string | null = null;
      if (cw.swatchR2Key) {
        try {
          swatchUrl = await createPresignedReadUrl(cw.swatchR2Key, 3600);
        } catch {
          swatchUrl = null;
        }
      }
      return {
        id: cw.colourway.id,
        slug: cw.colourway.slug,
        name: cw.colourway.name,
        nameUr: cw.colourway.nameUr,
        fabricId: cw.fabricId,
        fabricName: cw.fabricName,
        hexApproximation: cw.colourway.hexApproximation,
        priceDeltaMinor: cw.colourway.priceDeltaMinor,
        isDefault: cw.colourway.isDefault,
        sortOrder: cw.colourway.sortOrder,
        swatch: cw.swatchAssetId
          ? { assetId: cw.swatchAssetId, url: swatchUrl }
          : null,
      };
    }),
  );

  const defaultColourway =
    colourwaysPublic.find((c) => c.isDefault) ?? colourwaysPublic[0];
  if (!defaultColourway) return null;

  let modelDisclosure: string | null = null;
  const archetypeId = renderArchetypes.find((r) => r.archetypeId)?.archetypeId;
  if (archetypeId) {
    const [model] = await db
      .select()
      .from(houseModels)
      .where(eq(houseModels.id, archetypeId))
      .limit(1);
    if (model) {
      modelDisclosure = formatModelDisclosure(model);
    }
  }

  const occasionTag = tags.find((t) => t.kind === "OCCASION");
  const collectionBreadcrumb = occasionTag
    ? {
        slug: tagValueToCollectionSlug(occasionTag.value),
        label: titleFromTagValue(occasionTag.value),
      }
    : {
        slug: row.garmentCategory.key.toLowerCase().replace(/_/g, "-"),
        label: row.garmentCategory.name,
      };

  return {
    id: row.design.id,
    slug: row.design.slug,
    name: row.design.name,
    nameUr: row.design.nameUr,
    description: row.design.description,
    storyCopy: row.design.storyCopy,
    basePriceMinor: row.design.basePriceMinor,
    madeToMeasureSurchargeMinor: row.design.madeToMeasureSurchargeMinor,
    leadTimeDaysOverride: row.design.leadTimeDaysOverride,
    components: row.design.components ?? [],
    sizeBlockId: row.design.sizeBlockId,
    garmentCategory: row.garmentCategory,
    defaultColourwayId: defaultColourway.id,
    colourways: colourwaysPublic,
    tags,
    customizationOptions: optionValues.map(({ option, values }) => ({
      id: option.id,
      key: option.key,
      label: option.label,
      labelUr: option.labelUr,
      inputType: option.inputType,
      required: option.required,
      sortOrder: option.sortOrder,
      values: values.map((v) => ({
        id: v.id,
        value: v.value,
        label: v.label,
        labelUr: v.labelUr,
        priceDeltaMinor: v.priceDeltaMinor,
        sortOrder: v.sortOrder,
      })),
    })),
    modelDisclosure,
    collectionBreadcrumb,
  };
}
