"use client";

import {
  RTW_LOW_STOCK_THRESHOLD,
  rtwLowStockMessage,
} from "@/modules/inventory/rtw-stock-messages";

import type { SizeMode } from "./types";

type Props = {
  sizeMode: SizeMode;
  sizeLabel: string | null;
  sizes: readonly string[];
  /** Available units for the selected colourway: sizeLabel → qty. */
  availabilityBySize: Record<string, number>;
  onSizeModeChange: (mode: SizeMode) => void;
  onSizeLabelChange: (label: string | null) => void;
  onOpenSizeGuide: () => void;
};

export function DesignSizePicker({
  sizeMode,
  sizeLabel,
  sizes,
  availabilityBySize,
  onSizeModeChange,
  onSizeLabelChange,
  onOpenSizeGuide,
}: Props) {
  return (
    <div>
      <div className="size-head" id="pdp-size-head">
        Select a size
      </div>

      <div className="std" role="group" aria-labelledby="pdp-size-head">
        {sizes.map((label) => {
          const available = availabilityBySize[label] ?? 0;
          const soldOut = available <= 0;
          const lowStock =
            !soldOut &&
            available > 0 &&
            available <= RTW_LOW_STOCK_THRESHOLD;
          const active = sizeMode === "STANDARD" && sizeLabel === label;
          const title = soldOut
            ? `Size ${label} — sold out`
            : lowStock
              ? rtwLowStockMessage(available, label) ?? undefined
              : undefined;
          return (
            <button
              key={label}
              type="button"
              className={
                soldOut ? "sold-out" : active ? "on" : undefined
              }
              disabled={soldOut}
              aria-disabled={soldOut}
              aria-pressed={active}
              title={title}
              aria-label={
                soldOut
                  ? `Size ${label}, sold out`
                  : lowStock
                    ? `Size ${label}, ${available} left`
                    : `Size ${label}`
              }
              onClick={() => {
                if (soldOut) return;
                onSizeModeChange("STANDARD");
                onSizeLabelChange(label);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button type="button" className="size-guide-link" onClick={onOpenSizeGuide}>
        Size &amp; fit guide
      </button>
    </div>
  );
}
