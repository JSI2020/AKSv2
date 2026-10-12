"use client";

import { useEffect, useState } from "react";

import { Link, useRouter } from "@/i18n/routing";
import { isPersistedCartLineId } from "@/modules/cart/line-id";
import { useCart } from "@/modules/cart/cart-context";

const RESUME_KEY = "aks-checkout-resume";

/**
 * Checkout's server render saw an empty bag. The browser may still be
 * saving it, or restoring it after a reload. Wait, then refresh once so
 * the server can render the form. A bag that is really empty goes home.
 */
export function CheckoutResume() {
  const { cart, bagHydrated } = useCart();
  const router = useRouter();
  const [waited, setWaited] = useState(false);
  const persisted =
    cart.lines.length > 0 &&
    cart.lines.every((line) => isPersistedCartLineId(line.id));

  useEffect(() => {
    if (!bagHydrated) return;
    if (cart.lines.length === 0) {
      sessionStorage.removeItem(RESUME_KEY);
      router.replace("/");
      return;
    }
    if (!persisted) return;
    if (sessionStorage.getItem(RESUME_KEY) === "1") {
      setWaited(true);
      return;
    }
    sessionStorage.setItem(RESUME_KEY, "1");
    router.refresh();
  }, [bagHydrated, cart.lines.length, persisted, router]);

  if (waited) {
    return (
      <p className="py-16 text-[15px]" style={{ color: "var(--taupe)" }}>
        The bag did not reach checkout.{" "}
        <Link href="/cart" className="underline">
          Open your bag
        </Link>{" "}
        and try again.
      </p>
    );
  }

  return (
    <p className="py-16 text-[15px]" style={{ color: "var(--taupe)" }}>
      {cart.lines.length > 0 ? "Saving your bag…" : "Opening checkout…"}
    </p>
  );
}
