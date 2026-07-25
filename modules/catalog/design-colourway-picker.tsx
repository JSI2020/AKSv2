"use client";

import Image from "next/image";

import type { DesignColourwayPublic } from "./types";

type Props = {
  colourways: DesignColourwayPublic[];
  colourwayId: string;
  onSelect: (colourwayId: string) => void;
};

export function DesignColourwayPicker({
  colourways,
  colourwayId,
  onSelect,
}: Props) {
  return (
    <div>
      <p className="mb-3 font-display text-[11px] uppercase tracking-[0.14em] text-madder">
        Colour
      </p>
      <div className="flex flex-wrap gap-3">
        {colourways.map((cw) => {
          const active = cw.id === colourwayId;
          return (
            <button
              key={cw.id}
              type="button"
              aria-label={cw.name}
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(cw.id)}
              className={
                active
                  ? "border border-ink p-0.5"
                  : "border border-greige-deep p-0.5"
              }
            >
              <span className="relative block h-16 w-16 overflow-hidden">
                {cw.swatch?.url ? (
                  <Image
                    src={cw.swatch.url}
                    alt={cw.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                ) : cw.hexApproximation ? (
                  <span
                    className="block h-full w-full"
                    style={{ backgroundColor: cw.hexApproximation }}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-greige-deep text-[10px] text-ink/50">
                    {cw.name.slice(0, 2)}
                  </span>
                )}
              </span>
              <span className="mt-1 block max-w-16 truncate text-center text-[11px] text-ink/70">
                {cw.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
