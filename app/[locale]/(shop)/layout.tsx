import type { ReactNode } from "react";

import { auth } from "@/auth";
import { CartDrawer } from "@/modules/cart/cart-drawer";
import { CartProvider } from "@/modules/cart/cart-context";
import { AddToCartToast } from "@/modules/cart/add-toast";
import { loadActiveCart } from "@/modules/cart/queries";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";
import { ShopFooter, ShopHeader } from "@/modules/shop/shell/chrome";
import { ShopNuqsProvider } from "@/modules/shop/shell/nuqs-provider";
import {
  fontShopDisplay,
  fontShopSans,
  fontShopUrdu,
} from "@/lib/fonts";

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
          className={`shop-proto flex min-h-dvh flex-col ${fontShopSans.variable} ${fontShopDisplay.variable} ${fontShopUrdu.variable}`}
        >
          <ShopHeader />
          <div className="flex-1">{children}</div>
          <ShopFooter />
          <CartDrawer />
          <AddToCartToast />
        </div>
      </CartProvider>
    </ShopNuqsProvider>
  );
}
