import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { pageMetadata } from "@/modules/seo/metadata";
import { SizeGuidePageView } from "@/modules/shop/size-guide/size-guide-page";
import { listSizeGuideCharts } from "@/modules/shop/size-guide/queries";
import { ensureDefaultSizeBlocksForAllCategories } from "@/modules/sizing/ensure-default-blocks";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata = pageMetadata({
  title: "Size guide",
  description:
    "House size charts for AKS-Atelier ready-to-wear, XS–XXL. Measurements are garment measures.",
  path: "/size-guide",
});

export default async function SizeGuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("SizeGuide");
  // Guarantee house defaults exist so the page is not empty after a fresh DB.
  await ensureDefaultSizeBlocksForAllCategories();
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
