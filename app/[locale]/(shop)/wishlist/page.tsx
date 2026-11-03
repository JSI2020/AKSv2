import { setRequestLocale } from "next-intl/server";

import { pageMetadata } from "@/modules/seo/metadata";
import { WishlistPageView } from "@/modules/wishlist/wishlist-page-view";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

export const metadata = pageMetadata({
  title: "Wishlist",
  description: "Pieces saved from the AKS-Atelier shop.",
  path: "/wishlist",
  noindex: true,
});

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ShopPageContainer>
      <WishlistPageView />
    </ShopPageContainer>
  );
}
