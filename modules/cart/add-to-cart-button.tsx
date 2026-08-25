"use client";

import { useState } from "react";

import type {
  DesignDetailPublic,
  ResolvedImageTriple,
} from "@/modules/catalog/types";

import { useCart } from "./cart-context";
import type { CartCustomizationSelections } from "./types";
import { trackAddToCart } from "@/modules/analytics";

type Props = {
  design: DesignDetailPublic;
  colourwayId: string;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  quantity: number;
  measurementProfileId: string | null;
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
  measurementProfileId,
  customizationSelections,
  displayPriceMinor,
  images,
}: Props) {
  const { addItem, pending } = useCart();
  const [error, setError] = useState<string | null>(null);

  const colourway =
    design.colourways.find((c) => c.id === colourwayId) ?? design.colourways[0]!;

  const canAdd =
    sizeMode === "STANDARD"
      ? Boolean(sizeLabel)
      : Boolean(measurementProfileId);

  async function handleClick() {
    setError(null);

    const result = await addItem(
      {
        designId: design.id,
        colourwayId,
        sizeMode,
        sizeLabel,
        measurementProfileId,
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

  return (
    <div>
      <button
        type="button"
        className="addcart"
        disabled={pending || !canAdd}
        onClick={() => void handleClick()}
      >
        Add to bag
      </button>
      {!canAdd ? (
        <p
          style={{
            marginTop: "0.6rem",
            fontSize: "13px",
            color: "var(--taupe)",
          }}
        >
          {sizeMode === "STANDARD"
            ? "Choose a size to continue."
            : "Complete your measurements to add this piece."}
        </p>
      ) : null}
      {error ? (
        <p
          style={{
            marginTop: "0.6rem",
            fontSize: "13px",
            color: "var(--oxblood)",
          }}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
