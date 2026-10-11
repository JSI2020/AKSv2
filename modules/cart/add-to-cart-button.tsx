"use client";

import { useEffect, useRef, useState } from "react";

import type {
  DesignDetailPublic,
  ResolvedImageTriple,
} from "@/modules/catalog/types";

import {
  rtwLowStockMessage,
  rtwStockCapMessage,
} from "@/modules/inventory/rtw-stock-messages";

import { Money } from "@/modules/ui";

import { useCart } from "./cart-context";
import type { CartCustomizationSelections } from "./types";
import { trackAddToCart } from "@/modules/analytics";

type Props = {
  design: DesignDetailPublic;
  colourwayId: string;
  sizeMode: "STANDARD";
  sizeLabel: string | null;
  quantity: number;
  availableUnits: number;
  customizationSelections: CartCustomizationSelections;
  displayPriceMinor: number;
  images: ResolvedImageTriple;
  /** The whole selected shade has no stock (every size). */
  soldOut?: boolean;
  /**
   * Phone-width buy bar pinned to the bottom while this button is off screen.
   * `onChooseSize` runs when the shopper taps it before picking a size.
   */
  stickyBar?: { onChooseSize: () => void };
};

export function AddToCartButton({
  design,
  colourwayId,
  sizeMode,
  sizeLabel,
  quantity,
  availableUnits,
  customizationSelections,
  displayPriceMinor,
  images,
  soldOut: shadeSoldOut = false,
  stickyBar,
}: Props) {
  const { addItem, pending, drawerOpen } = useCart();
  const [error, setError] = useState<string | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const [barWanted, setBarWanted] = useState(false);

  // The bar shows only while the main button is off screen, and steps aside
  // once the footer scrolls in. Measured on scroll/resize (rAF-throttled)
  // rather than with an IntersectionObserver, whose single initial callback
  // can be taken mid layout-shift (images/fonts settling) and then go stale.
  useEffect(() => {
    if (!stickyBar) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const cta = ctaRef.current?.querySelector(".addcart");
      if (!cta) return;
      const vh = window.innerHeight;
      const r = cta.getBoundingClientRect();
      const ctaOffScreen = r.bottom < 0 || r.top > vh;
      const footer = document.querySelector(".shop-footer");
      const footerInView = footer
        ? footer.getBoundingClientRect().top < vh
        : false;
      setBarWanted(ctaOffScreen && !footerInView);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Late layout shifts (gallery images, web fonts) move the button too.
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [stickyBar]);

  const showBar = Boolean(stickyBar) && barWanted && !drawerOpen;

  const colourway =
    design.colourways.find((c) => c.id === colourwayId) ?? design.colourways[0]!;

  const comingSoon = design.comingSoon;
  const canAdd =
    !comingSoon && Boolean(sizeLabel) && availableUnits >= quantity;
  const lowStockMessage =
    sizeLabel != null ? rtwLowStockMessage(availableUnits, sizeLabel) : null;
  const sizeSoldOut = sizeLabel != null && availableUnits <= 0;
  const soldOut = !comingSoon && (shadeSoldOut || sizeSoldOut);

  async function handleClick() {
    setError(null);

    const result = await addItem(
      {
        designId: design.id,
        colourwayId,
        sizeMode: "STANDARD",
        sizeLabel,
        measurementProfileId: null,
        customizationSelections,
        quantity,
      },
      {
        designSlug: design.slug,
        designName: design.name,
        colourwayName: colourway.name,
        unitPriceMinor: displayPriceMinor,
        thumbnailUrl: images.FRONT?.url ?? null,
        leadTimeDays: design.leadTimeDaysOverride,
        maxQuantity: availableUnits,
      },
    );

    if (!result.ok) {
      setError(result.error ?? "Could not add to cart.");
      return;
    }

    trackAddToCart({
      designId: design.id,
      designSlug: design.slug,
      sizeMode,
      quantity,
    });
  }

  const statusStyle = {
    marginTop: "0.6rem",
    fontSize: "13px",
  } as const;

  return (
    <div ref={ctaRef}>
      <button
        type="button"
        className="addcart"
        disabled={pending || !canAdd}
        onClick={() => void handleClick()}
      >
        {soldOut ? "Sold out" : "Add to bag"}
      </button>
      {/* Status changes as the shopper picks a size/qty — announce them. */}
      <div aria-live="polite">
        {lowStockMessage ? (
          <p style={{ ...statusStyle, color: "var(--oxblood)" }}>
            {lowStockMessage}
          </p>
        ) : null}
        {!canAdd && !soldOut ? (
          <p style={{ ...statusStyle, color: "var(--taupe)" }}>
            {sizeLabel
              ? availableUnits > 0 && availableUnits < quantity
                ? `${rtwStockCapMessage(availableUnits, sizeLabel)} Reduce the quantity.`
                : "Choose a size to continue."
              : "Choose a size to continue."}
          </p>
        ) : null}
        {sizeSoldOut && !shadeSoldOut ? (
          <p style={{ ...statusStyle, color: "var(--taupe)" }}>
            This size is sold out. Pick another size or check back later.
          </p>
        ) : null}
      </div>
      {error ? (
        <p style={{ ...statusStyle, color: "var(--oxblood)" }} role="alert">
          {error}
        </p>
      ) : null}
      {stickyBar ? (
        <div
          className={`pdp-buybar${showBar ? " show" : ""}`}
          aria-hidden={!showBar}
          inert={!showBar}
        >
          <div className="pdp-buybar-info">
            <span className="pdp-buybar-name">{design.name}</span>
            <span className="pdp-buybar-meta">
              <Money value={displayPriceMinor} />
              {sizeLabel ? <span> · Size {sizeLabel}</span> : null}
            </span>
          </div>
          {soldOut ? (
            <button type="button" className="pdp-buybar-btn" disabled>
              Sold out
            </button>
          ) : canAdd ? (
            <button
              type="button"
              className="pdp-buybar-btn"
              disabled={pending}
              onClick={() => void handleClick()}
            >
              Add to bag
            </button>
          ) : (
            <button
              type="button"
              className="pdp-buybar-btn"
              onClick={stickyBar.onChooseSize}
            >
              Select size
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
