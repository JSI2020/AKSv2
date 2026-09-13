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
import { listHouseCollections } from "@/modules/catalog/house-collections-queries";
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
