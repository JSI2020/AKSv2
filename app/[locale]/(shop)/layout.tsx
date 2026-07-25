import type { ReactNode } from "react";

import {
  ShopFloatActions,
  ShopFooter,
  ShopHeader,
  ShopMarquee,
  ShopUtilityBar,
} from "@/modules/shop/shell/chrome";
import { ShopMobileNav } from "@/modules/shop/shell/mobile-nav";

export default async function ShopLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col bg-greige text-ink">
      <ShopUtilityBar />
      <ShopMarquee />
      <ShopHeader cartCount={0} />
      <ShopMobileNav />
      <div className="flex-1">{children}</div>
      <ShopFooter />
      <ShopFloatActions />
    </div>
  );
}
