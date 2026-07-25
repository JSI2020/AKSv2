/**
 * Tier 2 — collection context for the design brief.
 * When the Collections module (Tier 3) ships, replace the stub resolver.
 */

export type CollectionBriefContext = {
  slug: string;
  label: string;
  seasonTag?: string;
  occasionTags?: readonly string[];
  workTags?: readonly string[];
  /** Narrows the fabric picker when present. */
  fabricPaletteIds?: readonly string[];
  defaultArchetypeId?: string;
  defaultCategoryKey?: string;
  priceBandHint?: string;
};

/** Known storefront collection slugs — stub until Collections module exists. */
const COLLECTION_STUBS: Record<string, CollectionBriefContext> = {
  formal: {
    slug: "formal",
    label: "Formal",
    seasonTag: "WINTER",
    occasionTags: ["FORMAL", "SEMI_FORMAL"],
    workTags: ["EMBROIDERED"],
  },
  fusion: {
    slug: "fusion",
    label: "Fusion",
    seasonTag: "MID_SEASON",
    occasionTags: ["EVERYDAY", "CASUAL"],
    workTags: ["PRINTED"],
  },
  new: {
    slug: "new",
    label: "New arrivals",
    seasonTag: "SPRING",
    occasionTags: ["EVERYDAY"],
  },
  embroidered: {
    slug: "embroidered",
    label: "Embroidered",
    workTags: ["EMBROIDERED", "HAND_EMBELLISHED", "ZARI"],
  },
};

/**
 * Resolve collection brief context from a slug.
 * Returns null when absent or unknown — caller falls back to studio defaults.
 */
export function resolveCollectionBriefContext(
  slug: string | null | undefined,
): CollectionBriefContext | null {
  if (!slug?.trim()) return null;
  const key = slug.trim().toLowerCase();
  return COLLECTION_STUBS[key] ?? null;
}
