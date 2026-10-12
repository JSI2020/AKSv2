"use client";

import { useEffect, useState } from "react";

import { Link, useRouter } from "@/i18n/routing";
import { isPersistedCartLineId } from "@/modules/cart/line-id";
import { useCart } from "@/modules/cart/cart-context";

const MAX_ATTEMPTS = 12;
const ATTEMPT_KEY = "aks-checkout-resume-attempts";

function readAttempts(): number {
  try {
    return Number(sessionStorage.getItem(ATTEMPT_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function writeAttempts(value: number) {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, String(value));
  } catch {
    // Private mode can block storage; the in-memory timer still retries.
  }
}

function clearAttempts() {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Checkout's server render saw an empty bag. The browser may still be
 * saving it. Refresh until the server cart arrives, then this view
 * unmounts. A bag that never lands gets a way back instead of spinning.
 */
export function CheckoutResume() {
  const { cart, bagHydrated } = useCart();
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  const lineCount = cart.lines.length;
  const persisted =
    lineCount > 0 && cart.lines.every((line) => isPersistedCartLineId(line.id));

  useEffect(() => {
    if (!bagHydrated) return;
    if (lineCount === 0) {
      clearAttempts();
      router.replace("/");
      return;
    }

    setGaveUp(false);
    let cancelled = false;
    let attempts = readAttempts();
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      attempts += 1;
      writeAttempts(attempts);
      if (attempts >= MAX_ATTEMPTS) {
        setGaveUp(true);
        return;
      }
      router.refresh();
      timer = setTimeout(tick, 500);
    };

    timer = setTimeout(tick, persisted ? 50 : 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bagHydrated, lineCount, persisted, router]);

  if (gaveUp) {
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
      {lineCount > 0 ? "Saving your bag…" : "Opening checkout…"}
    </p>
  );
}
