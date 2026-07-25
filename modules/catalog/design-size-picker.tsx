"use client";

import { Link } from "@/i18n/routing";

import { STANDARD_SIZE_LABELS, type SizeMode } from "./types";

type Props = {
  designSlug: string;
  sizeMode: SizeMode;
  sizeLabel: string | null;
  onSizeModeChange: (mode: SizeMode) => void;
  onSizeLabelChange: (label: string | null) => void;
  onOpenSizeGuide: () => void;
};

export function DesignSizePicker({
  designSlug,
  sizeMode,
  sizeLabel,
  onSizeModeChange,
  onSizeLabelChange,
  onOpenSizeGuide,
}: Props) {
  return (
    <div>
      <p className="mb-3 font-display text-[11px] uppercase tracking-[0.14em] text-madder">
        Size
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STANDARD_SIZE_LABELS.map((label) => {
          const active = sizeMode === "STANDARD" && sizeLabel === label;
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
        <button
          type="button"
          onClick={onOpenSizeGuide}
          className="border border-greige-deep px-3.5 py-2 text-[12px] uppercase tracking-[0.08em] text-ink"
        >
          Size guide
        </button>
      </div>
      {sizeMode === "MADE_TO_MEASURE" ? (
        <span className="inline-block border border-ink bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-greige">
          Made to measure
        </span>
      ) : (
        <Link
          href={`/designs/${designSlug}/measure`}
          className="inline-block border border-greige-deep px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-ink"
        >
          Made to measure
        </Link>
      )}
    </div>
  );
}
