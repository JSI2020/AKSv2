import { setRequestLocale } from "next-intl/server";

import { CollectionsHubPage } from "@/modules/catalog/collections-hub";
import { listHouseCollections } from "@/modules/catalog/house-collections-queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CollectionsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const collections = await listHouseCollections({ activeOnly: true });

  return (
    <main>
      <CollectionsHubPage collections={collections} />
    </main>
  );
}
