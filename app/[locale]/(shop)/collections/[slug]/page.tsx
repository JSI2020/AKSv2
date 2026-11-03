import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { CollectionPageView } from "@/modules/catalog/collection-page";
import { pageMetadata } from "@/modules/seo/metadata";
import { metaDescription } from "@/modules/seo/site";
import {
  getCollectionFacetOptions,
  getPublishedDesigns,
  resolveCollection,
  collectionSearchParamsCache,
  searchParamsToFilters,
} from "@/modules/catalog";
import { listHouseCollections } from "@/modules/catalog/house-collections-queries";
import {
  automaticPercentForDesign,
  loadActiveAutomaticPercentDiscounts,
} from "@/modules/discounts/storefront-badges";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await resolveCollection(slug);
  if (!collection) {
    return pageMetadata({
      title: "Collection not found",
      description: "That collection is not in the AKS-Atelier shop.",
      path: `/collections/${slug}`,
      noindex: true,
    });
  }
  const description = metaDescription(
    collection.description?.trim() ||
      `${collection.title} — ready-to-wear from AKS-Atelier. Quiet luxury, East meets West.`,
  );
  return pageMetadata({
    title: collection.title,
    description,
    path: `/collections/${collection.slug}`,
  });
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const collection = await resolveCollection(slug);
  if (!collection) notFound();

  const parsed = collectionSearchParamsCache.parse(await searchParams);
  const { filters, page: requestedPage } = searchParamsToFilters(parsed);
  const sort = parsed.sort ?? collection.defaultSort;

  const [{ items, total, page, pageCount }, facets, autoDiscounts, collections] =
    await Promise.all([
      getPublishedDesigns({
        baseFilters: collection.baseFilters,
        filters,
        sort,
        page: requestedPage,
      }),
      getCollectionFacetOptions(),
      loadActiveAutomaticPercentDiscounts(),
      listHouseCollections({ activeOnly: true }),
    ]);

  const doorLabels = Object.fromEntries(
    collections.flatMap((c) => [
      [c.tag, c.navLabel],
      ["WHITE_COLLECTION", "Signature"],
    ]),
  );
  const collectionPills = collections.map((c) => ({
    slug: c.slug,
    label: c.navLabel,
  }));

  const withBadges = items.map((d) => ({
    ...d,
    automaticPercentOff: automaticPercentForDesign({
      designId: d.id,
      freeTags: d.freeTags,
      garmentTypeKey: d.garmentTypeKey,
      discounts: autoDiscounts,
    }),
  }));

  return (
    <CollectionPageView
      collection={collection}
      collectionPills={collectionPills}
      doorLabels={doorLabels}
      items={withBadges}
      total={total}
      page={page}
      pageCount={pageCount}
      facets={facets}
    />
  );
}
