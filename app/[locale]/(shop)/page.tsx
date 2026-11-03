import { setRequestLocale } from "next-intl/server";

import { getSiteSettings } from "@/modules/content/site-settings";
import { homeJsonLd, JsonLd } from "@/modules/seo/json-ld";
import { pageMetadata } from "@/modules/seo/metadata";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "@/modules/seo/site";
import { HomePage } from "@/modules/shop/home/home-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export const metadata = pageMetadata({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

export default async function ShopHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const settings = await getSiteSettings();

  return (
    <>
      <JsonLd data={homeJsonLd(settings)} />
      <HomePage />
    </>
  );
}
