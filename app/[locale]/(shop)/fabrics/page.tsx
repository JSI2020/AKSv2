import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { pageMetadata } from "@/modules/seo/metadata";
import { FabricsPageView } from "@/modules/shop/fabrics/fabrics-page";
import { listStorefrontFabrics } from "@/modules/shop/fabrics/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata = pageMetadata({
  title: "Fabrics",
  description:
    "Natural cloth at AKS-Atelier — matte fibres chosen for drape and how they age. Quiet luxury, East meets West.",
  path: "/fabrics",
});

export default async function FabricsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Fabrics");
  const fabrics = await listStorefrontFabrics();

  return (
    <FabricsPageView
      fabrics={fabrics}
      copy={{
        title: t("title"),
        lead: t("lead"),
        empty: t("empty"),
        care: t("care"),
        drape: t("drape"),
      }}
    />
  );
}
