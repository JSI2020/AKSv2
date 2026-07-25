import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { CatalogFilters, DesignSort } from "./types";

export const SORT_VALUES = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "best_selling",
] as const satisfies readonly DesignSort[];

/** Price in whole PKR rupees in the URL; converted to paisa for queries. */
export const collectionFilterParsers = {
  occasion: parseAsArrayOf(parseAsString).withDefault([]),
  work: parseAsArrayOf(parseAsString).withDefault([]),
  garment: parseAsArrayOf(parseAsString).withDefault([]),
  fabric: parseAsArrayOf(parseAsString).withDefault([]),
  priceMin: parseAsInteger,
  priceMax: parseAsInteger,
  sort: parseAsStringLiteral(SORT_VALUES),
  page: parseAsInteger.withDefault(1),
};

export const collectionSearchParamsCache = createSearchParamsCache(
  collectionFilterParsers,
);

export function searchParamsToFilters(
  params: Awaited<ReturnType<typeof collectionSearchParamsCache.parse>>,
): { filters: CatalogFilters; sort: DesignSort; page: number } {
  const filters: CatalogFilters = {};
  if (params.occasion.length) filters.occasion = params.occasion;
  if (params.work.length) filters.work = params.work;
  if (params.garment.length) filters.garmentTypeKeys = params.garment;
  if (params.fabric.length) filters.fabricIds = params.fabric;
  if (params.priceMin != null) filters.priceMinMinor = params.priceMin * 100;
  if (params.priceMax != null) filters.priceMaxMinor = params.priceMax * 100;

  return {
    filters,
    sort: (params.sort ?? "newest") as DesignSort,
    page: params.page,
  };
}
