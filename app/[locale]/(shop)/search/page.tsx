import { setRequestLocale } from "next-intl/server";

import { DesignCard } from "@/modules/catalog/design-card";
import { SearchBox } from "@/modules/catalog/search-box";
import {
  collectionSearchParamsCache,
  getPublishedDesigns,
  searchParamsToFilters,
} from "@/modules/catalog";
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

  const [{ items, total }, autoDiscounts, collections] = await Promise.all([
    hasQuery
      ? getPublishedDesigns({ filters, sort, page })
      : Promise.resolve({ items: [], total: 0 }),
    loadActiveAutomaticPercentDiscounts(),
    listHouseCollections({ activeOnly: true }),
  ]);

  const doorLabels = Object.fromEntries(
    collections.flatMap((c) => [
      [c.tag, c.navLabel],
      ["WHITE_COLLECTION", "Signature"],
    ]),
  );

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
    <ShopPageContainer>
      <div className="mx-auto max-w-[1500px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
        <h1 className="serif mb-6 text-[clamp(1.8rem,3.5vw,2.4rem)] font-light leading-none">
          Search
        </h1>

        <div className="max-w-[560px]">
          <SearchBox initialQuery={query} />
        </div>

        {hasQuery ? (
          <>
            <p className="mb-8 mt-6 text-[13px]" style={{ color: "var(--taupe)" }}>
              {total === 0
                ? `Nothing matched “${query}”. Try a name, an item code, a garment like “kameez”, or a colour.`
                : `${total} ${total === 1 ? "piece" : "pieces"} for “${query}”`}
            </p>
            {total > 0 ? (
              <div className="grid">
                {withBadges.map((design) => (
                  <DesignCard
                    key={design.id}
                    design={design}
                    doorLabels={doorLabels}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mb-8 mt-6 text-[13px]" style={{ color: "var(--taupe)" }}>
            Search by article name or code, by garment — kameez, kurta, trouser —
            or by colour like blue or red.
          </p>
        )}
      </div>
    </ShopPageContainer>
  );
}
