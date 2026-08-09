import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { FabricsPageView } from "@/modules/shop/fabrics/fabrics-page";
import { listStorefrontFabrics } from "@/modules/shop/fabrics/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

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
