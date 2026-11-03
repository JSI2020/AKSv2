import { setRequestLocale } from "next-intl/server";

import { getPublishedDesigns, resolveCollection } from "@/modules/catalog";
import { pageMetadata } from "@/modules/seo/metadata";
import { CollectionsHubPage } from "@/modules/catalog/collections-hub";
import { listHouseCollections } from "@/modules/catalog/house-collections-queries";
import { loadStorefrontHomepage } from "@/modules/content/homepage";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata = pageMetadata({
  title: "Collections",
  description:
    "Essentials, Tailored, Occasion, and Signature at AKS-Atelier. Quiet luxury ready-to-wear — East meets West in the cut and the cloth.",
  path: "/collections",
});

export default async function CollectionsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [collections, homepage] = await Promise.all([
    listHouseCollections({ activeOnly: true }),
    loadStorefrontHomepage(),
  ]);

  // Cover = the homepage category-door photo for that collection (admin
  // curated), else the newest piece in it. Count comes from the same query.
  const tileImageByKey = new Map(
    (homepage?.tiles ?? [])
      .filter((t) => t.imageUrl)
      .map((t) => [t.categoryKey.trim().toLowerCase(), t.imageUrl!]),
  );

  const covers = await Promise.all(
    collections.map(async (c) => {
      const resolved = await resolveCollection(c.slug);
      const { items, total } = resolved
        ? await getPublishedDesigns({
            baseFilters: resolved.baseFilters,
            sort: resolved.defaultSort,
            pageSize: 1,
          })
        : { items: [], total: 0 };
      return {
        slug: c.slug,
        imageUrl:
          tileImageByKey.get(c.slug.toLowerCase()) ??
          items[0]?.thumbnail?.url ??
          null,
        pieceCount: total,
      };
    }),
  );
  const coverBySlug = Object.fromEntries(covers.map((c) => [c.slug, c]));

  return <CollectionsHubPage collections={collections} covers={coverBySlug} />;
}
