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
      <Link href={`/designs/${designSlug}/measure`} className="size-primary">
        <span>
          <span className="t">Made to your measurements</span>
          <br />
          <span className="s">cut to your body</span>
        </span>
        <span style={{ fontSize: "1.2rem" }} aria-hidden>
          →
        </span>
      </Link>

      <div className="size-or">or a standard house size</div>

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

      {sizeMode === "MADE_TO_MEASURE" ? (
        <p
          style={{
            marginTop: "0.8rem",
            fontSize: "12px",
            color: "var(--sage)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Made to measure selected
        </p>
      ) : null}
    </div>
  );
}
