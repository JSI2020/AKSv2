import type { ReactNode } from "react";

import { auth } from "@/auth";
import { CartDrawer, CartProvider, loadActiveCart } from "@/modules/cart";
import { getOrSetAnonToken } from "@/modules/measure";
import {
  ShopFloatActions,
  ShopFooter,
  ShopHeader,
  ShopMarquee,
  ShopUtilityBar,
} from "@/modules/shop/shell/chrome";
import { ShopMobileNav } from "@/modules/shop/shell/mobile-nav";
import { ShopNuqsProvider } from "@/modules/shop/shell/nuqs-provider";

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
        <div className="flex min-h-dvh flex-col bg-greige text-ink">
          <ShopUtilityBar />
          <ShopMarquee />
          <ShopHeader />
          <ShopMobileNav />
          <div className="flex-1">{children}</div>
          <ShopFooter />
          <ShopFloatActions />
          <CartDrawer />
        </div>
      </CartProvider>
    </ShopNuqsProvider>
  );
}
