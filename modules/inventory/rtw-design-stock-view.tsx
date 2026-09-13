"use client";

import Link from "next/link";
import { useState } from "react";

import { RtwQuickStockAdjust } from "./rtw-quick-stock-adjust";

export type RtwDesignStockDetail = {
  id: string;
  name: string;
  colourways: {
    id: string;
    name: string;
    fabricName: string;
    hex: string | null;
    availableSizeLabels: string[];
    sizes: {
      label: string;
      onHand: number;
      reserved: number;
      stockId: string;
    }[];
  }[];
};

export function RtwDesignStockView({
  detail,
}: {
  detail: RtwDesignStockDetail;
}) {
  const [colourIdx, setColourIdx] = useState(0);
  const colour = detail.colourways[colourIdx];
  if (!colour) {
    return (
      <p className="text-[13px] text-ink/55">No shades on this design.</p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {detail.colourways.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColourIdx(i)}
            className={
              i === colourIdx
                ? "flex flex-col items-start gap-0.5 border border-ink bg-ink px-3 py-2 text-start text-milk"
                : "flex flex-col items-start gap-0.5 border border-ink/12 px-3 py-2 text-start text-ink/55 hover:border-ink"
            }
          >
            <span className="flex items-center gap-2 text-[12.5px]">
              <span
                className="size-3.5 shrink-0 rounded-full border border-ink/15"
                style={{ backgroundColor: c.hex ?? "#CDC0A8" }}
              />
              {c.name}
            </span>
            {c.fabricName && c.fabricName !== c.name ? (
              <span
                className={
                  i === colourIdx
                    ? "ps-5.5 text-[10px] text-milk/70"
                    : "ps-5.5 text-[10px] text-ink/40"
                }
              >
                {c.fabricName}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-ink/45">
        Sizes for this shade:{" "}
        {colour.availableSizeLabels.length > 0
          ? colour.availableSizeLabels.join(", ")
          : "none configured — set them in Design → Sizing"}
      </p>

      <div className="flex flex-wrap gap-3">
        {colour.sizes.map((s) => {
          const low = s.onHand <= 2;
          const pct = Math.min(100, (s.onHand / 10) * 100);
          const bar =
            s.onHand === 0 ? "bg-madder" : low ? "bg-zari" : "bg-sage";
          return (
            <Link
              key={s.label}
              href={`/admin/inventory/designs/${detail.id}/${colour.id}/${encodeURIComponent(s.label)}`}
              className="min-w-[5.5rem] border border-ink/12 bg-milk px-4 py-4 text-center transition-colors hover:border-ink"
            >
              <p className="font-data text-[11px] text-ink/55">{s.label}</p>
              <p
                className={`my-1 font-display text-[2rem] font-light leading-none ${
                  low ? "text-madder" : "text-ink"
                }`}
              >
                {s.onHand}
              </p>
              <div className="h-1.5 overflow-hidden bg-greige/50">
                <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
              {s.reserved > 0 ? (
                <p className="mt-1 text-[10px] text-ink/45">
                  {s.reserved} reserved
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>

      <RtwQuickStockAdjust
        designName={detail.name}
        colourwayName={colour.name}
        sizes={colour.sizes.map((s) => ({
          label: s.label,
          onHand: s.onHand,
          stockId: s.stockId,
        }))}
      />
    </div>
  );
}
