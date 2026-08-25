"use server";

import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import {
  assets,
  colourways,
  db,
  designRenders,
  designs,
  garmentCategories,
} from "@aks/db";
import { requirePermission } from "@/modules/auth";
import { createPresignedReadUrl } from "@/modules/platform/assets";

export type StudioCatalogCard = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  status: string;
  /** Active = published on storefront; Inactive = draft / pipeline / archived. */
  active: boolean;
  basePriceMinor: number;
  compareAtPriceMinor: number | null;
  categoryKey: string;
  categoryName: string;
  /** Piece keys from design.components; falls back to categoryKey. */
  components: string[];
  colourwayHexes: string[];
  colourwayCount: number;
  availableSizeLabels: string[];
  madeToMeasureOffered: boolean;
  featured: boolean;
  thumbnailUrl: string | null;
  thumbnailAlt: string;
  updatedAt: Date;
};

export type StudioCatalogGroup = {
  categoryKey: string;
  categoryName: string;
  designs: StudioCatalogCard[];
};

/** Full catalogue for Studio hub — every design, grouped by category. */
export async function listStudioCatalogGrouped(): Promise<StudioCatalogGroup[]> {
  await requirePermission("designs.view");

  const categories = await db
    .select({
      id: garmentCategories.id,
      key: garmentCategories.key,
      name: garmentCategories.name,
      sortOrder: garmentCategories.sortOrder,
    })
    .from(garmentCategories)
    .where(eq(garmentCategories.active, true))
    .orderBy(asc(garmentCategories.sortOrder));

  const rows = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      name: designs.name,
      subtitle: designs.subtitle,
      status: designs.status,
      basePriceMinor: designs.basePriceMinor,
      compareAtPriceMinor: designs.compareAtPriceMinor,
      components: designs.components,
      availableSizeLabels: designs.availableSizeLabels,
      madeToMeasureOffered: designs.madeToMeasureOffered,
      featured: designs.featured,
      updatedAt: designs.updatedAt,
      categoryKey: garmentCategories.key,
      categoryName: garmentCategories.name,
      categorySort: garmentCategories.sortOrder,
    })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .where(ne(designs.status, "ARCHIVED"))
    .orderBy(asc(garmentCategories.sortOrder), desc(designs.updatedAt));

  if (rows.length === 0) {
    return categories.map((c) => ({
      categoryKey: c.key,
      categoryName: c.name,
      designs: [],
    }));
  }

  const ids = rows.map((r) => r.id);

  const hexRows = await db
    .select({
      designId: colourways.designId,
      hex: colourways.hexApproximation,
      isDefault: colourways.isDefault,
      sortOrder: colourways.sortOrder,
    })
    .from(colourways)
    .where(and(inArray(colourways.designId, ids), eq(colourways.active, true)))
    .orderBy(desc(colourways.isDefault), asc(colourways.sortOrder));

  const hexesByDesign = new Map<string, string[]>();
  const countByDesign = new Map<string, number>();
  for (const row of hexRows) {
    countByDesign.set(
      row.designId,
      (countByDesign.get(row.designId) ?? 0) + 1,
    );
    if (!row.hex) continue;
    const list = hexesByDesign.get(row.designId) ?? [];
    if (list.length >= 5) continue;
    list.push(row.hex);
    hexesByDesign.set(row.designId, list);
  }

  const thumbs = await db
    .select({
      designId: designRenders.designId,
      assetId: designRenders.assetId,
      altText: designRenders.altText,
      r2Key: assets.r2Key,
      angle: designRenders.angle,
      isDefault: colourways.isDefault,
      sortOrder: designRenders.sortOrder,
    })
    .from(designRenders)
    .innerJoin(colourways, eq(designRenders.colourwayId, colourways.id))
    .innerJoin(assets, eq(designRenders.assetId, assets.id))
    .where(
      and(
        inArray(designRenders.designId, ids),
        eq(colourways.active, true),
      ),
    )
    .orderBy(
      desc(colourways.isDefault),
      asc(designRenders.sortOrder),
    );

  const thumbByDesign = new Map<string, (typeof thumbs)[number]>();
  for (const t of thumbs) {
    if (thumbByDesign.has(t.designId)) continue;
    if (t.angle === "FRONT" || t.angle === "THREE_QUARTER") {
      thumbByDesign.set(t.designId, t);
    }
  }
  for (const t of thumbs) {
    if (!thumbByDesign.has(t.designId)) {
      thumbByDesign.set(t.designId, t);
    }
  }

  const cards: StudioCatalogCard[] = await Promise.all(
    rows.map(async (r) => {
      const thumb = thumbByDesign.get(r.id);
      let thumbnailUrl: string | null = null;
      if (thumb) {
        try {
          thumbnailUrl = await createPresignedReadUrl(thumb.r2Key, 3600);
        } catch {
          thumbnailUrl = null;
        }
      }
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        subtitle: r.subtitle,
        status: r.status,
        active: r.status === "PUBLISHED",
        basePriceMinor: r.basePriceMinor,
        compareAtPriceMinor: r.compareAtPriceMinor,
        categoryKey: r.categoryKey,
        categoryName: r.categoryName,
        components:
          r.components?.length > 0 ? r.components : [r.categoryKey],
        colourwayHexes: hexesByDesign.get(r.id) ?? [],
        colourwayCount: countByDesign.get(r.id) ?? 0,
        availableSizeLabels: r.availableSizeLabels ?? [],
        madeToMeasureOffered: r.madeToMeasureOffered,
        featured: r.featured,
        thumbnailUrl,
        thumbnailAlt: thumb?.altText?.trim() || r.name,
        updatedAt: r.updatedAt,
      };
    }),
  );

  const byKey = new Map<string, StudioCatalogCard[]>();
  for (const card of cards) {
    const list = byKey.get(card.categoryKey) ?? [];
    list.push(card);
    byKey.set(card.categoryKey, list);
  }

  const seen = new Set<string>();
  const groups: StudioCatalogGroup[] = [];
  for (const c of categories) {
    seen.add(c.key);
    groups.push({
      categoryKey: c.key,
      categoryName: c.name,
      designs: byKey.get(c.key) ?? [],
    });
  }
  for (const [key, designsInGroup] of byKey) {
    if (seen.has(key)) continue;
    groups.push({
      categoryKey: key,
      categoryName: designsInGroup[0]?.categoryName ?? key,
      designs: designsInGroup,
    });
  }

  return groups;
}
