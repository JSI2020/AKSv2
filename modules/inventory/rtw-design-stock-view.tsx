"use client";

import Link from "next/link";
import { useState } from "react";

export type RtwDesignStockDetail = {
  id: string;
  name: string;
  colourways: {
    id: string;
    name: string;
    hex: string | null;
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
      <p className="text-[13px] text-ink/55">No colourways on this design.</p>
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
                ? "flex items-center gap-2 border border-ink bg-ink px-3 py-2 text-[12.5px] text-milk"
                : "flex items-center gap-2 border border-ink/12 px-3 py-2 text-[12.5px] text-ink/55 hover:border-ink"
            }
          >
            <span
              className="size-3.5 rounded-full border border-ink/15"
              style={{ backgroundColor: c.hex ?? "#CDC0A8" }}
            />
            {c.name}
          </button>
        ))}
      </div>

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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
