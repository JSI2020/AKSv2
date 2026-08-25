import { setRequestLocale } from "next-intl/server";

import { HomePage } from "@/modules/shop/home/home-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ShopHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomePage />;
}
