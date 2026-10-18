import { sql } from "drizzle-orm";

import { db, garmentCategories } from "@aks/db";

import {
  COLLECTION_INTRO,
  isOccasionValue,
  isWorkValue,
  slugToCatalogueValue,
  SYSTEM_COLLECTION_SLUGS,
  titleFromTagValue,
  type ResolvedCollection,
} from "./types";
import {
  getHouseCollectionBySlug,
  resolveHouseCollectionBySlug,
} from "./house-collections-queries";
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

  if (normalized === "all" || normalized === "shop") {
    return {
      kind: "attribute",
      slug: "all",
      title: "All pieces",
      description: COLLECTION_INTRO,
      baseFilters: {},
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
      description:
        "Pieces published in the last 30 days. Older looks stay in their house door.",
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

  if (system === "coming_soon") {
    return {
      kind: "system",
      slug: normalized,
      title: "Coming soon",
      tagline: "On the cutting table",
      description:
        "Pieces we are finishing now. Have a look, and message us to hear the moment one is ready.",
      system: "coming_soon",
      baseFilters: { comingSoon: true },
      defaultSort: "newest",
    };
  }

  const house =
    (await getHouseCollectionBySlug(normalized)) ??
    resolveHouseCollectionBySlug(normalized);
  if (house) {
    const freeTags = [house.tag];
    if (house.slug === "signature") {
      freeTags.push("WHITE_COLLECTION");
    }
    return {
      kind: "attribute",
      slug: house.slug,
      title: house.title,
      tagline: house.tagline,
      description: house.intro,
      baseFilters: { freeTags },
      defaultSort: "newest",
    };
  }

  // Alias: former White Collection → Signature
  if (normalized === "white-collection") {
    const signature =
      (await getHouseCollectionBySlug("signature")) ??
      resolveHouseCollectionBySlug("signature");
    if (!signature) return null;
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

  // Garment categories, including ones marked inactive. A nav link must
  // still open a page — hiding a category does not 404 it.
  const [category] = await db
    .select({
      key: garmentCategories.key,
      name: garmentCategories.name,
    })
    .from(garmentCategories)
    .where(sql`lower(${garmentCategories.key}) = ${normalized}`)
    .limit(1);

  return {
    kind: "attribute",
    slug: normalized,
    title: category?.name ?? titleFromTagValue(tagValue),
    description: COLLECTION_INTRO,
    baseFilters: { garmentTypeKeys: [category?.key ?? tagValue] },
    defaultSort: "newest",
  };
}
