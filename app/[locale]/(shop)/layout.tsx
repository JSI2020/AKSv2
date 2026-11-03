import type { ReactNode } from "react";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { isNoindexPath } from "@/modules/seo/site";
import { CartDrawer } from "@/modules/cart/cart-drawer";
import { CartProvider } from "@/modules/cart/cart-context";
import { AddToCartToast } from "@/modules/cart/add-toast";
import { loadActiveCart } from "@/modules/cart/queries";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";
import { AksSvgSprite } from "@/modules/shop/shell/aks-svg-sprite";
import { ShopFooter, ShopHeader } from "@/modules/shop/shell/chrome";
import { MotionEnhancer } from "@/modules/shop/shell/motion-enhancer";
import { ShopNuqsProvider } from "@/modules/shop/shell/nuqs-provider";
import { fontShopDisplay, fontShopSans } from "@/lib/fonts";

/** Canonical public path, and noindex for account, cart, and checkout. */
export async function generateMetadata() {
  const path = (await headers()).get("x-aks-pathname")?.split("?")[0];
  if (!path) return {};
  const stripped = path.replace(/^\/en(?=\/|$)/, "") || "/";
  const canonical = stripped === "" ? "/" : stripped;
  if (!isNoindexPath(canonical)) {
    return { alternates: { canonical } };
  }
  return {
    alternates: { canonical },
    robots: { index: false, follow: false },
  };
}

export default async function ShopLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getOrSetAnonToken();
  const initialCart = await loadActiveCart({ userId, anonId });

  return (
    <ShopNuqsProvider>
      <CartProvider initialCart={initialCart}>
        <div
          className={`shop-proto flex min-h-dvh flex-col ${fontShopSans.variable} ${fontShopDisplay.variable}`}
        >
          <AksSvgSprite />
          <ShopHeader />
          <div className="shop-main flex-1">{children}</div>
          <ShopFooter />
          <CartDrawer />
          <AddToCartToast />
          <MotionEnhancer />
        </div>
      </CartProvider>
    </ShopNuqsProvider>
  );
}
