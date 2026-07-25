import { DESIGN_TAG_VALUES } from "@aks/shared";

export type DesignSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "best_selling";

export type CatalogFilters = {
  occasion?: string[];
  work?: string[];
  freeTags?: string[];
  garmentTypeKeys?: string[];
  fabricIds?: string[];
  /** Inclusive, paisa. */
  priceMinMinor?: number;
  /** Inclusive, paisa. */
  priceMaxMinor?: number;
  /** Restrict to these design ids (system collections). */
  designIds?: string[];
  /** publishedAt >= now - N days (new arrivals). */
  publishedWithinDays?: number;
};

export type ResolvedCollection =
  | {
      kind: "system";
      slug: string;
      title: string;
      description: string;
      system: "new_arrivals" | "best_sellers";
      baseFilters: CatalogFilters;
      defaultSort: DesignSort;
    }
  | {
      kind: "attribute";
      slug: string;
      title: string;
      description: string;
      baseFilters: CatalogFilters;
      defaultSort: DesignSort;
    };

export type PublishedDesignCard = {
  id: string;
  slug: string;
  name: string;
  nameUr: string;
  basePriceMinor: number;
  publishedAt: Date | null;
  garmentTypeKey: string;
  garmentTypeName: string;
  occasionLabels: string[];
  thumbnail: {
    assetId: string;
    r2Key: string;
    altText: string;
    url: string | null;
  } | null;
};

export const SYSTEM_COLLECTION_SLUGS = {
  new: "new_arrivals",
  "new-arrivals": "new_arrivals",
  "best-sellers": "best_sellers",
  "best-selling": "best_sellers",
} as const;

export type SystemCollectionKey =
  (typeof SYSTEM_COLLECTION_SLUGS)[keyof typeof SYSTEM_COLLECTION_SLUGS];

export function slugToCatalogueValue(slug: string): string {
  return slug.trim().toUpperCase().replace(/-/g, "_");
}

export function titleFromTagValue(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function isOccasionValue(value: string): boolean {
  return (DESIGN_TAG_VALUES.OCCASION as readonly string[]).includes(value);
}

export function isWorkValue(value: string): boolean {
  return (DESIGN_TAG_VALUES.WORK as readonly string[]).includes(value);
}

export const COLLECTION_INTRO =
  "Everything is made to order. Choose what's yours; we begin the moment you do.";
