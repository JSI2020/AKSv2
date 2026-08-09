import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { SizeGuidePageView } from "@/modules/shop/size-guide/size-guide-page";
import { listSizeGuideCharts } from "@/modules/shop/size-guide/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SizeGuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("SizeGuide");
  const charts = await listSizeGuideCharts();

  return (
    <SizeGuidePageView
      charts={charts}
      copy={{
        title: t("title"),
        lead: t("lead"),
        customPrimary: t("customPrimary"),
        customCta: t("customCta"),
        standardNote: t("standardNote"),
        empty: t("empty"),
        baseSize: t("baseSize"),
      }}
    />
  );
}
