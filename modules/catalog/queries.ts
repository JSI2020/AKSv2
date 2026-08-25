import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lte,
} from "drizzle-orm";

import {
  assets,
  colourways,
  db,
  designRenders,
  designs,
  designTags,
  fabrics,
  garmentCategories,
} from "@aks/db";

import { createPresignedReadUrl } from "@/modules/platform/assets/r2";

import type {
  CatalogFilters,
  DesignSort,
  PublishedDesignCard,
} from "./types";

const PAGE_SIZE_DEFAULT = 24;

function mergeFilters(
  base: CatalogFilters,
  extra: CatalogFilters,
): CatalogFilters {
  return {
    occasion: uniq([...(base.occasion ?? []), ...(extra.occasion ?? [])]),
    work: uniq([...(base.work ?? []), ...(extra.work ?? [])]),
    freeTags: uniq([...(base.freeTags ?? []), ...(extra.freeTags ?? [])]),
    garmentTypeKeys: uniq([
      ...(base.garmentTypeKeys ?? []),
      ...(extra.garmentTypeKeys ?? []),
    ]),
    fabricIds: uniq([...(base.fabricIds ?? []), ...(extra.fabricIds ?? [])]),
    priceMinMinor: extra.priceMinMinor ?? base.priceMinMinor,
    priceMaxMinor: extra.priceMaxMinor ?? base.priceMaxMinor,
    designIds: extra.designIds ?? base.designIds,
    publishedWithinDays:
      extra.publishedWithinDays ?? base.publishedWithinDays,
  };
}

function uniq(values: string[]): string[] | undefined {
  const out = [...new Set(values.filter(Boolean))];
  return out.length ? out : undefined;
}

export type GetPublishedDesignsInput = {
  filters?: CatalogFilters;
  baseFilters?: CatalogFilters;
  sort?: DesignSort;
  page?: number;
  pageSize?: number;
};

export type GetPublishedDesignsResult = {
  items: PublishedDesignCard[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/**
 * Faceted listing of PUBLISHED designs. Filter state should live in the URL.
 */
export async function getPublishedDesigns(
  input: GetPublishedDesignsInput = {},
): Promise<GetPublishedDesignsResult> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    48,
    Math.max(1, input.pageSize ?? PAGE_SIZE_DEFAULT),
  );
  const sort = input.sort ?? "newest";
  const filters = mergeFilters(input.baseFilters ?? {}, input.filters ?? {});

  if (filters.designIds && filters.designIds.length === 0) {
    return { items: [], total: 0, page, pageSize, pageCount: 0 };
  }

  const conditions = [eq(designs.status, "PUBLISHED")];

  if (filters.designIds?.length) {
    conditions.push(inArray(designs.id, filters.designIds));
  }

  if (filters.publishedWithinDays != null) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - filters.publishedWithinDays);
    conditions.push(gte(designs.publishedAt, since));
  }

  if (filters.priceMinMinor != null) {
    conditions.push(gte(designs.basePriceMinor, filters.priceMinMinor));
  }
  if (filters.priceMaxMinor != null) {
    conditions.push(lte(designs.basePriceMinor, filters.priceMaxMinor));
  }

  if (filters.garmentTypeKeys?.length) {
    conditions.push(
      inArray(
        garmentCategories.key,
        filters.garmentTypeKeys.map((k) => k.toUpperCase()),
      ),
    );
  }

  if (filters.occasion?.length) {
    conditions.push(
      exists(
        db
          .select({ one: designTags.designId })
          .from(designTags)
          .where(
            and(
              eq(designTags.designId, designs.id),
              eq(designTags.kind, "OCCASION"),
              inArray(designTags.value, filters.occasion),
            ),
          ),
      ),
    );
  }

  if (filters.work?.length) {
    conditions.push(
      exists(
        db
          .select({ one: designTags.designId })
          .from(designTags)
          .where(
            and(
              eq(designTags.designId, designs.id),
              eq(designTags.kind, "WORK"),
              inArray(designTags.value, filters.work),
            ),
          ),
      ),
    );
  }

  if (filters.freeTags?.length) {
    conditions.push(
      exists(
        db
          .select({ one: designTags.designId })
          .from(designTags)
          .where(
            and(
              eq(designTags.designId, designs.id),
              eq(designTags.kind, "FREE"),
              inArray(designTags.value, filters.freeTags),
            ),
          ),
      ),
    );
  }

  if (filters.fabricIds?.length) {
    conditions.push(
      exists(
        db
          .select({ one: colourways.id })
          .from(colourways)
          .where(
            and(
              eq(colourways.designId, designs.id),
              eq(colourways.active, true),
              inArray(colourways.fabricId, filters.fabricIds),
            ),
          ),
      ),
    );
  }

  const where = and(...conditions);

  const orderBy = (() => {
    switch (sort) {
      case "oldest":
        return [asc(designs.publishedAt), asc(designs.name)];
      case "price_asc":
        return [asc(designs.basePriceMinor), asc(designs.name)];
      case "price_desc":
        return [desc(designs.basePriceMinor), asc(designs.name)];
      case "best_selling":
      case "newest":
      default:
        return [desc(designs.publishedAt), asc(designs.name)];
    }
  })();

  const [totalRow] = await db
    .select({ total: count() })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .where(where);

  const total = Number(totalRow?.total ?? 0);
  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;

  let rows = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      name: designs.name,
      nameUr: designs.nameUr,
      basePriceMinor: designs.basePriceMinor,
      compareAtPriceMinor: designs.compareAtPriceMinor,
      compareAtStartsAt: designs.compareAtStartsAt,
      compareAtEndsAt: designs.compareAtEndsAt,
      publishedAt: designs.publishedAt,
      garmentTypeKey: garmentCategories.key,
      garmentTypeName: garmentCategories.name,
    })
    .from(designs)
    .innerJoin(
      garmentCategories,
      eq(designs.garmentTypeId, garmentCategories.id),
    )
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset(offset);

  if (sort === "best_selling" && filters.designIds?.length) {
    const rank = new Map(filters.designIds.map((id, i) => [id, i]));
    rows = [...rows].sort(
      (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999),
    );
  }

  if (rows.length === 0) {
    return { items: [], total, page, pageSize, pageCount };
  }

  const ids = rows.map((r) => r.id);

  const tags = await db
    .select({
      designId: designTags.designId,
      kind: designTags.kind,
      value: designTags.value,
    })
    .from(designTags)
    .where(
      and(
        inArray(designTags.designId, ids),
        inArray(designTags.kind, ["OCCASION", "FREE"]),
      ),
    );

  const occasionByDesign = new Map<string, string[]>();
  const freeByDesign = new Map<string, string[]>();
  for (const t of tags) {
    if (t.kind === "OCCASION") {
      const list = occasionByDesign.get(t.designId) ?? [];
      list.push(t.value);
      occasionByDesign.set(t.designId, list);
    } else if (t.kind === "FREE") {
      const list = freeByDesign.get(t.designId) ?? [];
      list.push(t.value);
      freeByDesign.set(t.designId, list);
    }
  }

  const hexRows = await db
    .select({
      designId: colourways.designId,
      hex: colourways.hexApproximation,
      sortOrder: colourways.sortOrder,
      isDefault: colourways.isDefault,
    })
    .from(colourways)
    .where(and(inArray(colourways.designId, ids), eq(colourways.active, true)))
    .orderBy(desc(colourways.isDefault), asc(colourways.sortOrder));

  const hexesByDesign = new Map<string, string[]>();
  for (const row of hexRows) {
    if (!row.hex) continue;
    const list = hexesByDesign.get(row.designId) ?? [];
    if (list.length >= 4) continue;
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
        inArray(designRenders.angle, ["FRONT", "THREE_QUARTER"]),
        eq(colourways.active, true),
      ),
    )
    .orderBy(desc(colourways.isDefault), asc(designRenders.sortOrder));

  const thumbByDesign = new Map<string, (typeof thumbs)[number]>();
  const hoverByDesign = new Map<string, (typeof thumbs)[number]>();
  for (const t of thumbs) {
    if (t.angle === "FRONT" && !thumbByDesign.has(t.designId)) {
      thumbByDesign.set(t.designId, t);
    }
    if (t.angle === "THREE_QUARTER" && !hoverByDesign.has(t.designId)) {
      hoverByDesign.set(t.designId, t);
    }
  }
  // Fall back: second FRONT from another colourway if no three-quarter
  for (const t of thumbs) {
    if (t.angle !== "FRONT") continue;
    const primary = thumbByDesign.get(t.designId);
    if (!primary || hoverByDesign.has(t.designId)) continue;
    if (t.assetId !== primary.assetId) {
      hoverByDesign.set(t.designId, t);
    }
  }

  const items: PublishedDesignCard[] = await Promise.all(
    rows.map(async (r) => {
      const thumb = thumbByDesign.get(r.id);
      const hover = hoverByDesign.get(r.id);
      let url: string | null = null;
      let hoverUrl: string | null = null;
      if (thumb) {
        try {
          url = await createPresignedReadUrl(thumb.r2Key, 3600);
        } catch {
          url = null;
        }
      }
      if (hover) {
        try {
          hoverUrl = await createPresignedReadUrl(hover.r2Key, 3600);
        } catch {
          hoverUrl = null;
        }
      }
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        nameUr: r.nameUr,
        basePriceMinor: r.basePriceMinor,
        compareAtPriceMinor: r.compareAtPriceMinor,
        compareAtStartsAt: r.compareAtStartsAt,
        compareAtEndsAt: r.compareAtEndsAt,
        publishedAt: r.publishedAt,
        garmentTypeKey: r.garmentTypeKey,
        garmentTypeName: r.garmentTypeName,
        occasionLabels: occasionByDesign.get(r.id) ?? [],
        freeTags: freeByDesign.get(r.id) ?? [],
        colourwayHexes: hexesByDesign.get(r.id) ?? [],
        thumbnail: thumb
          ? {
              assetId: thumb.assetId,
              r2Key: thumb.r2Key,
              altText: thumb.altText,
              url,
            }
          : null,
        hoverThumbnail: hover
          ? {
              assetId: hover.assetId,
              r2Key: hover.r2Key,
              altText: hover.altText,
              url: hoverUrl,
            }
          : null,
      };
    }),
  );

  return { items, total, page, pageSize, pageCount };
}

export async function getCollectionFacetOptions() {
  const [occasionRows, workRows, garmentRows, fabricRows] = await Promise.all([
    db
      .selectDistinct({ value: designTags.value })
      .from(designTags)
      .innerJoin(designs, eq(designTags.designId, designs.id))
      .where(
        and(eq(designs.status, "PUBLISHED"), eq(designTags.kind, "OCCASION")),
      )
      .orderBy(asc(designTags.value)),
    db
      .selectDistinct({ value: designTags.value })
      .from(designTags)
      .innerJoin(designs, eq(designTags.designId, designs.id))
      .where(and(eq(designs.status, "PUBLISHED"), eq(designTags.kind, "WORK")))
      .orderBy(asc(designTags.value)),
    db
      .select({
        key: garmentCategories.key,
        name: garmentCategories.name,
      })
      .from(garmentCategories)
      .where(eq(garmentCategories.active, true))
      .orderBy(asc(garmentCategories.sortOrder), asc(garmentCategories.name)),
    db
      .select({
        id: fabrics.id,
        name: fabrics.name,
      })
      .from(fabrics)
      .where(eq(fabrics.active, true))
      .orderBy(asc(fabrics.name)),
  ]);

  return {
    occasions: occasionRows.map((r) => r.value),
    work: workRows.map((r) => r.value),
    garmentTypes: garmentRows,
    fabrics: fabricRows,
  };
}
