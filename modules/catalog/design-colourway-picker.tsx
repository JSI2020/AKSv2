"use client";

import { ShopImage } from "@/modules/shop/media/shop-image";

import type { DesignColourwayPublic } from "./types";

type Props = {
  colourways: DesignColourwayPublic[];
  colourwayId: string;
  onSelect: (colourwayId: string) => void;
  /** Shade has no stock in any size — still selectable, but marked. */
  isSoldOut?: (colourwayId: string) => boolean;
};

export function DesignColourwayPicker({
  colourways,
  colourwayId,
  onSelect,
  isSoldOut,
}: Props) {
  const selected =
    colourways.find((c) => c.id === colourwayId) ?? colourways[0];

  return (
    <div>
      <div className="opt-label" id="pdp-shade-label">
        Shade <span className="val">{selected?.name ?? ""}</span>
      </div>
      <div className="colours" role="group" aria-labelledby="pdp-shade-label">
        {colourways.map((cw) => {
          const active = cw.id === colourwayId;
          const soldOut = isSoldOut?.(cw.id) ?? false;
          return (
            <button
              key={cw.id}
              type="button"
              className={`colour${active ? " on" : ""}${soldOut ? " sold-out" : ""}`}
              aria-label={soldOut ? `${cw.name}, sold out` : cw.name}
              aria-pressed={active}
              title={soldOut ? `${cw.name} — sold out` : cw.name}
              onClick={() => onSelect(cw.id)}
              style={
                !cw.swatch?.url && cw.hexApproximation
                  ? { background: cw.hexApproximation }
                  : undefined
              }
            >
              {cw.swatch?.url ? (
                <ShopImage
                  src={cw.swatch.url}
                  alt=""
                  fill
                  sizes="34px"
                  className="object-cover"
                />
              ) : !cw.hexApproximation ? (
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  {cw.name.slice(0, 2).toUpperCase()}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
