"use client";

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
      <div className="size-head">Select a size</div>

      <div className="std">
        {sizes.map((label) => {
          const available = availabilityBySize[label] ?? 0;
          const soldOut = available <= 0;
          const active = sizeMode === "STANDARD" && sizeLabel === label;
          return (
            <button
              key={label}
              type="button"
              className={
                soldOut ? "sold-out" : active ? "on" : undefined
              }
              disabled={soldOut}
              aria-disabled={soldOut}
              title={soldOut ? "Sold out" : undefined}
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
