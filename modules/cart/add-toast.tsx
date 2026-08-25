"use client";

import { useEffect, useState } from "react";

import { useCart } from "./cart-context";

/**
 * Fixed bottom-end toast after successful add-to-cart (prototype C).
 */
export function AddToCartToast() {
  const { lastAddedName, clearLastAdded, openDrawer } = useCart();
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!lastAddedName) return;

    setText(lastAddedName);
    setVisible(true);

    const hide = window.setTimeout(() => {
      setVisible(false);
      clearLastAdded();
    }, 2600);

    return () => window.clearTimeout(hide);
  }, [lastAddedName, clearLastAdded]);

  return (
    <div
      className={`toast${visible ? " show" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="g">Added</span>
      <span>{text}</span>
      <button
        type="button"
        className="toast-bag"
        onClick={() => {
          openDrawer();
          setVisible(false);
          clearLastAdded();
        }}
      >
        View bag
      </button>
    </div>
  );
}
