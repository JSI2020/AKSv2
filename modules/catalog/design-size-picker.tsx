"use client";

import { STANDARD_SIZE_LABELS, type SizeMode } from "./types";

type Props = {
  sizeMode: SizeMode;
  sizeLabel: string | null;
  onSizeModeChange: (mode: SizeMode) => void;
  onSizeLabelChange: (label: string | null) => void;
};

export function DesignSizePicker({
  sizeMode,
  sizeLabel,
  onSizeModeChange,
  onSizeLabelChange,
}: Props) {
  return (
    <div>
      <p className="mb-3 font-display text-[11px] uppercase tracking-[0.14em] text-madder">
        Size
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {STANDARD_SIZE_LABELS.map((label) => {
          const active =
            sizeMode === "STANDARD" && sizeLabel === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                onSizeModeChange("STANDARD");
                onSizeLabelChange(label);
              }}
              className={
                active
                  ? "border border-ink bg-ink px-3.5 py-2 text-[13px] text-greige"
                  : "border border-greige-deep px-3.5 py-2 text-[13px] text-ink"
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          onSizeModeChange("MADE_TO_MEASURE");
          onSizeLabelChange(null);
        }}
        className={
          sizeMode === "MADE_TO_MEASURE"
            ? "border border-ink bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-greige"
            : "border border-greige-deep px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-ink"
        }
      >
        Made to measure
      </button>
    </div>
  );
}
