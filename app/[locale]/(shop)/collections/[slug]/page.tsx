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

  const [{ items, total }, facets] = await Promise.all([
    getPublishedDesigns({
      baseFilters: collection.baseFilters,
      filters,
      sort,
      page,
    }),
    getCollectionFacetOptions(),
  ]);

  return (
    <CollectionPageView
      collection={collection}
      items={items}
      total={total}
      facets={facets}
    />
  );
}
