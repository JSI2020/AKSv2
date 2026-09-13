"use client";

import { useState } from "react";

import type {
  DesignDetailPublic,
  ResolvedImageTriple,
} from "@/modules/catalog/types";

import {
  rtwLowStockMessage,
  rtwStockCapMessage,
} from "@/modules/inventory/rtw-stock-messages";

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
}: Props) {
  const { addItem, pending } = useCart();
  const [error, setError] = useState<string | null>(null);

  const colourway =
    design.colourways.find((c) => c.id === colourwayId) ?? design.colourways[0]!;

  const canAdd = Boolean(sizeLabel) && availableUnits >= quantity;
  const lowStockMessage =
    sizeLabel != null ? rtwLowStockMessage(availableUnits, sizeLabel) : null;
  const soldOut = sizeLabel != null && availableUnits <= 0;

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
    <div>
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
        {soldOut ? (
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
    </div>
  );
}
