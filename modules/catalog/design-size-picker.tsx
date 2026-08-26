"use client";

import { STANDARD_SIZE_LABELS, type SizeMode } from "./types";

type Props = {
  sizeMode: SizeMode;
  sizeLabel: string | null;
  onSizeModeChange: (mode: SizeMode) => void;
  onSizeLabelChange: (label: string | null) => void;
  onOpenSizeGuide: () => void;
};

export function DesignSizePicker({
  sizeMode,
  sizeLabel,
  onSizeModeChange,
  onSizeLabelChange,
  onOpenSizeGuide,
}: Props) {
  return (
    <div>
      <div className="size-head">Select a size</div>

      <div className="std">
        {STANDARD_SIZE_LABELS.filter((l) => l !== "XXL").map((label) => {
          const active = sizeMode === "STANDARD" && sizeLabel === label;
          return (
            <button
              key={label}
              type="button"
              className={active ? "on" : undefined}
              onClick={() => {
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
