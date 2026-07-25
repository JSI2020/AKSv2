import { setRequestLocale } from "next-intl/server";

import { ShopHomeHero } from "@/modules/shop/shell/home-hero";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <ShopHomeHero />
    </main>
  );
}
