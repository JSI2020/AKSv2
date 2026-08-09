import {
  COLLECTION_INTRO,
  isOccasionValue,
  isWorkValue,
  slugToCatalogueValue,
  SYSTEM_COLLECTION_SLUGS,
  titleFromTagValue,
  type ResolvedCollection,
} from "./types";
import { getHouseCollectionBySlug } from "./house-collections";
import { getPaidSalesRanking } from "./sales-ranking";

const NEW_ARRIVAL_DAYS = 30;

/**
 * Resolves a collection URL slug to a house edition, system collection,
 * or attribute-filter collection (occasion / work / garment type key).
 */
export async function resolveCollection(
  slug: string,
): Promise<ResolvedCollection | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const house = getHouseCollectionBySlug(normalized);
  if (house) {
    return {
      kind: "attribute",
      slug: house.slug,
      title: house.title,
      tagline: house.tagline,
      description: house.intro,
      baseFilters: { freeTags: [house.tag] },
      defaultSort: "newest",
    };
  }

  // Alias: former White Collection → Signature
  if (normalized === "white-collection") {
    const signature = getHouseCollectionBySlug("signature")!;
    return {
      kind: "attribute",
      slug: signature.slug,
      title: signature.title,
      tagline: signature.tagline,
      description: signature.intro,
      baseFilters: { freeTags: [signature.tag, "WHITE_COLLECTION"] },
      defaultSort: "newest",
    };
  }

  const system =
    SYSTEM_COLLECTION_SLUGS[
      normalized as keyof typeof SYSTEM_COLLECTION_SLUGS
    ];

  if (system === "new_arrivals") {
    return {
      kind: "system",
      slug: normalized,
      title: "New",
      description: COLLECTION_INTRO,
      system: "new_arrivals",
      baseFilters: { publishedWithinDays: NEW_ARRIVAL_DAYS },
      defaultSort: "newest",
    };
  }

  if (system === "best_sellers") {
    const ranking = await getPaidSalesRanking(90);
    return {
      kind: "system",
      slug: normalized,
      title: "Best sellers",
      description: COLLECTION_INTRO,
      system: "best_sellers",
      baseFilters: {
        designIds: ranking.map((r) => r.designId),
      },
      defaultSort: "best_selling",
    };
  }

  const tagValue = slugToCatalogueValue(normalized);

  if (isOccasionValue(tagValue)) {
    return {
      kind: "attribute",
      slug: normalized,
      title: titleFromTagValue(tagValue),
      description: COLLECTION_INTRO,
      baseFilters: { occasion: [tagValue] },
      defaultSort: "newest",
    };
  }

  if (isWorkValue(tagValue)) {
    return {
      kind: "attribute",
      slug: normalized,
      title: titleFromTagValue(tagValue),
      description: COLLECTION_INTRO,
      baseFilters: { work: [tagValue] },
      defaultSort: "newest",
    };
  }

  if (normalized === "fusion") {
    return {
      kind: "attribute",
      slug: normalized,
      title: "Fusion",
      description: COLLECTION_INTRO,
      baseFilters: { freeTags: ["FUSION"] },
      defaultSort: "newest",
    };
  }

  // Treat remaining slugs as garment category keys (e.g. /collections/kameez).
  return {
    kind: "attribute",
    slug: normalized,
    title: titleFromTagValue(tagValue),
    description: COLLECTION_INTRO,
    baseFilters: { garmentTypeKeys: [tagValue] },
    defaultSort: "newest",
  };
}
