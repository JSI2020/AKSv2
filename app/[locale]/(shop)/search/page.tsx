import { setRequestLocale } from "next-intl/server";

import {
  collectionSearchParamsCache,
  getCollectionFacetOptions,
  getPublishedDesigns,
  searchParamsToFilters,
} from "@/modules/catalog";
import { SearchPageView } from "@/modules/catalog/search-page-view";
import { listHouseCollections } from "@/modules/catalog/house-collections-queries";
import {
  automaticPercentForDesign,
  loadActiveAutomaticPercentDiscounts,
} from "@/modules/discounts/storefront-badges";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const parsed = collectionSearchParamsCache.parse(await searchParams);
  const { filters, sort, page } = searchParamsToFilters(parsed);
  const query = parsed.q.trim();
  const hasQuery = query.length > 0;

  const [catalog, facets, autoDiscounts, collections] = await Promise.all([
    hasQuery
      ? getPublishedDesigns({ filters, sort, page })
      : Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 24,
          pageCount: 0,
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

  const withBadges = catalog.items.map((d) => ({
    ...d,
    automaticPercentOff: automaticPercentForDesign({
      designId: d.id,
      freeTags: d.freeTags,
      garmentTypeKey: d.garmentTypeKey,
      discounts: autoDiscounts,
    }),
  }));

  return (
    <ShopPageContainer>
      <SearchPageView
        query={query}
        items={withBadges}
        total={catalog.total}
        pageCount={catalog.pageCount}
        facets={facets}
        doorLabels={doorLabels}
      />
    </ShopPageContainer>
  );
}
