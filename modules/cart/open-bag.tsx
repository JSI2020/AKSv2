"use client";

import { useEffect } from "react";

import { useRouter } from "@/i18n/routing";

import { useCart } from "./cart-context";

/** /cart and /bag land on the shop with the bag drawer open. */
export function OpenBag() {
  const { openDrawer } = useCart();
  const router = useRouter();

  useEffect(() => {
    openDrawer();
    router.replace("/");
  }, [openDrawer, router]);

  return (
    <p className="px-6 py-16 text-[15px]" style={{ color: "var(--taupe)" }}>
      Opening your bag…
    </p>
  );
}
