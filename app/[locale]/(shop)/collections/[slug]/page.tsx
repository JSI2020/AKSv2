import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { CollectionPageView } from "@/modules/catalog/collection-page";
import {
  getCollectionFacetOptions,
  getPublishedDesigns,
  resolveCollection,
  collectionSearchParamsCache,
  searchParamsToFilters,
} from "@/modules/catalog";
import {
  automaticPercentForDesign,
  loadActiveAutomaticPercentDiscounts,
} from "@/modules/discounts/storefront-badges";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const collection = await resolveCollection(slug);
  if (!collection) notFound();

  const parsed = collectionSearchParamsCache.parse(await searchParams);
  const { filters, page } = searchParamsToFilters(parsed);
  const sort = parsed.sort ?? collection.defaultSort;

  const [{ items, total }, facets, autoDiscounts] = await Promise.all([
    getPublishedDesigns({
      baseFilters: collection.baseFilters,
      filters,
      sort,
      page,
    }),
    getCollectionFacetOptions(),
    loadActiveAutomaticPercentDiscounts(),
  ]);

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
      items={withBadges}
      total={total}
      facets={facets}
    />
  );
}
