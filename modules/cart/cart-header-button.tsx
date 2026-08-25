"use client";

import { useCart } from "./cart-context";

type Props = {
  label: string;
  /** Prototype C header uses text label instead of bag icon. */
  textOnly?: boolean;
};

export function CartHeaderButton({ label, textOnly = false }: Props) {
  const { cart, toggleDrawer } = useCart();

  if (textOnly) {
    return (
      <button type="button" onClick={toggleDrawer} aria-label={label}>
        {label}
        {cart.itemCount > 0 ? ` (${cart.itemCount})` : ""}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleDrawer}
      className="relative inline-flex"
      aria-label={label}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
      >
        <path d="M6 8h12l-1.2 11.2a1.5 1.5 0 01-1.5 1.3H8.7a1.5 1.5 0 01-1.5-1.3L6 8z" />
        <path d="M9 8V6a3 3 0 016 0v2" />
      </svg>
      <span className="absolute -end-1.5 -top-1.5 inline-flex size-[15px] items-center justify-center bg-madder font-data text-[9px] leading-none text-greige">
        {cart.itemCount}
      </span>
    </button>
  );
}
