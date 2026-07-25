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

export type GalleryAngle = "FRONT" | "THREE_QUARTER" | "BACK";

export type ResolvedRenderImage = {
  assetId: string;
  r2Key: string;
  altText: string;
  url: string | null;
} | null;

export type ResolvedImageTriple = Record<GalleryAngle, ResolvedRenderImage>;

export type DesignColourwayPublic = {
  id: string;
  slug: string;
  name: string;
  nameUr: string;
  fabricId: string;
  fabricName: string;
  hexApproximation: string | null;
  priceDeltaMinor: number;
  isDefault: boolean;
  sortOrder: number;
  swatch: {
    assetId: string;
    url: string | null;
  } | null;
};

export type DesignDetailPublic = {
  id: string;
  slug: string;
  name: string;
  nameUr: string;
  description: string | null;
  storyCopy: string | null;
  basePriceMinor: number;
  madeToMeasureSurchargeMinor: number;
  leadTimeDaysOverride: number | null;
  /** e.g. ["KAMEEZ","TROUSER","DUPATTA"] for multi-piece. */
  components: string[];
  sizeBlockId: string | null;
  garmentCategory: {
    id: string;
    key: string;
    name: string;
  };
  defaultColourwayId: string;
  colourways: DesignColourwayPublic[];
  tags: { kind: string; value: string }[];
  customizationOptions: {
    id: string;
    key: string;
    label: string;
    labelUr: string;
    inputType: "SELECT" | "BOOLEAN";
    required: boolean;
    sortOrder: number;
    values: {
      id: string;
      value: string;
      label: string;
      labelUr: string;
      priceDeltaMinor: number;
      sortOrder: number;
    }[];
  }[];
  modelDisclosure: string | null;
  collectionBreadcrumb: {
    slug: string;
    label: string;
  };
};

export type SizeMode = "STANDARD" | "MADE_TO_MEASURE";

export type ConfiguratorState = {
  angle: GalleryAngle;
  colourwayId: string;
  sizeMode: SizeMode;
  sizeLabel: string | null;
  measurements: Record<string, number>;
  quantity: number;
};

export const STANDARD_SIZE_LABELS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
] as const;

export function tagValueToCollectionSlug(value: string): string {
  return value.toLowerCase().replace(/_/g, "-");
}

export function formatLeadTime(daysOverride: number | null): string {
  if (daysOverride != null) {
    return `${daysOverride} days, begins on order`;
  }
  return "18–24 days, begins on order";
}

export function resolveColourwayId(
  param: string | null,
  colourways: DesignColourwayPublic[],
  defaultId: string,
): string {
  if (!param) return defaultId;
  const bySlug = colourways.find((c) => c.slug === param);
  if (bySlug) return bySlug.id;
  const byId = colourways.find((c) => c.id === param);
  if (byId) return byId.id;
  return defaultId;
}

export function colourwayUrlValue(
  colourwayId: string,
  colourways: DesignColourwayPublic[],
): string {
  return colourways.find((c) => c.id === colourwayId)?.slug ?? colourwayId;
}
