import { setRequestLocale } from "next-intl/server";

import { CollectionsHubPage } from "@/modules/catalog/collections-hub";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CollectionsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <CollectionsHubPage />
    </main>
  );
}
