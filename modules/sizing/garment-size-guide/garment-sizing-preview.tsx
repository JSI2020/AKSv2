"use client";

import { useMemo, useState } from "react";

import { formatMeasure } from "@/modules/ui";
import type { DisplayUnit } from "@/modules/dress-sizing/core/units";
import type { SilhouetteMode } from "@/modules/dress-sizing/core/silhouette";

import { computeGarmentOverlayLines } from "./garment-overlay-math";
import type { GarmentChartRow } from "./types";

type Theme = "admin" | "design" | "shop";

const THEME_STYLES: Record<
  Theme,
  {
    caption: string;
    meta: string;
    frame: string;
    stroke: string;
    strokeMuted: string;
    valueLabel: string;
    nameLabel: string;
  }
> = {
  admin: {
    caption: "font-sans text-[11px] uppercase tracking-[0.12em] text-chalk",
    meta: "font-data text-[11px] text-chalk",
    frame: "relative w-full overflow-hidden border border-indigo-lift bg-indigo-lift",
    stroke: "#8FA6B2",
    strokeMuted: "#8FA6B280",
    valueLabel: "#8FA6B2",
    nameLabel: "#DCD9CF",
  },
  design: {
    caption: "font-sans text-[11px] uppercase tracking-[0.12em] text-ink/55",
    meta: "font-data text-[11px] text-ink/55",
    frame: "relative w-full overflow-hidden border border-ink/12 bg-greige/30",
    stroke: "#16181D",
    strokeMuted: "#16181D66",
    valueLabel: "#16181D",
    nameLabel: "#16181DB3",
  },
  shop: {
    caption: "size-guide-preview-caption",
    meta: "size-guide-preview-meta",
    frame: "size-guide-preview-frame",
    stroke: "#2B2926",
    strokeMuted: "#2B292666",
    valueLabel: "#2B2926",
    nameLabel: "#2B2926B3",
  },
};

type Props = {
  imageUrl: string;
  rows: GarmentChartRow[];
  unit: DisplayUnit;
  silhouette: SilhouetteMode;
  highlightKey?: string | null;
  baseSize?: string;
  theme?: Theme;
};

export function GarmentSizingPreview({
  imageUrl,
  rows,
  unit,
  silhouette,
  highlightKey = null,
  baseSize = "M",
  theme = "admin",
}: Props) {
  const [dims, setDims] = useState({ w: 1024, h: 1024 });
  const measureUnit = unit === "cm" ? "cm" : "in";
  const styles = THEME_STYLES[theme];

  const lines = useMemo(() => {
    return computeGarmentOverlayLines({
      rows,
      sizeLabel: baseSize,
      imageWidthPx: dims.w,
      imageHeightPx: dims.h,
      silhouette,
      formatValue: (v) => formatMeasure(v, measureUnit),
    });
  }, [rows, baseSize, dims.h, dims.w, silhouette, measureUnit]);

  const w = dims.w > 0 ? dims.w : 1024;
  const h = dims.h > 0 ? dims.h : 1024;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={styles.caption}>Ghost mannequin · template chart overlay</p>
        <p className={styles.meta}>Base {baseSize} · length-calibrated placement</p>
      </div>
      <div className={styles.frame} style={{ aspectRatio: `${w} / ${h}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 size-full object-contain"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0) {
              setDims({ w: img.naturalWidth, h: img.naturalHeight });
            }
          }}
        />
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {lines.map((line) => {
            const active =
              !highlightKey || highlightKey === line.measurementKey;
            const stroke = active ? styles.stroke : styles.strokeMuted;
            const strokeW = Math.max(1, w / 400);
            const labelX =
              line.kind === "vertical" ? line.x1 + w / 28 : line.x2 + w / 48;

            if (line.kind === "diagonal") {
              // Runs along the sleeve, so the end tick is perpendicular to the
              // line itself rather than horizontal.
              const dx = line.x2 - line.x1;
              const dy = line.yPx - line.anchorYPx;
              const len = Math.hypot(dx, dy) || 1;
              const tick = w / 56;
              const nx = (-dy / len) * tick;
              const ny = (dx / len) * tick;
              return (
                <g key={line.pomKey} opacity={active ? 1 : 0.45}>
                  <line
                    x1={line.x1}
                    y1={line.anchorYPx}
                    x2={line.x2}
                    y2={line.yPx}
                    stroke={stroke}
                    strokeWidth={strokeW}
                    strokeDasharray={`${w / 80} ${w / 160}`}
                  />
                  <line
                    x1={line.x2 - nx}
                    y1={line.yPx - ny}
                    x2={line.x2 + nx}
                    y2={line.yPx + ny}
                    stroke={stroke}
                    strokeWidth={Math.max(1, w / 500)}
                  />
                  <text
                    x={line.x2 + w / 48}
                    y={line.yPx - w / 120}
                    fill={styles.valueLabel}
                    fontSize={Math.max(10, w / 48)}
                    fontFamily="var(--font-martian-mono), monospace"
                  >
                    {line.displayLabel}
                  </text>
                  <text
                    x={line.x2 + w / 48}
                    y={line.yPx + w / 36}
                    fill={styles.nameLabel}
                    fontSize={Math.max(8, w / 64)}
                    fontFamily="var(--font-sans), sans-serif"
                  >
                    {line.label}
                  </text>
                </g>
              );
            }

            if (line.kind === "vertical") {
              // Label at the midpoint — at the end it collides with whatever
              // horizontal line shares that height (length vs hem sweep).
              const midY = (line.anchorYPx + line.yPx) / 2;
              return (
                <g key={line.pomKey} opacity={active ? 1 : 0.45}>
                  <line
                    x1={line.x1}
                    y1={line.anchorYPx}
                    x2={line.x2}
                    y2={line.yPx}
                    stroke={stroke}
                    strokeWidth={strokeW}
                    strokeDasharray={`${w / 80} ${w / 160}`}
                  />
                  <line
                    x1={line.x1 - w / 56}
                    y1={line.yPx}
                    x2={line.x2 + w / 56}
                    y2={line.yPx}
                    stroke={stroke}
                    strokeWidth={Math.max(1, w / 500)}
                  />
                  <text
                    x={labelX}
                    y={midY - w / 120}
                    fill={styles.valueLabel}
                    fontSize={Math.max(10, w / 48)}
                    fontFamily="var(--font-martian-mono), monospace"
                  >
                    {line.displayLabel}
                  </text>
                  <text
                    x={labelX}
                    y={midY + w / 36}
                    fill={styles.nameLabel}
                    fontSize={Math.max(8, w / 64)}
                    fontFamily="var(--font-sans), sans-serif"
                  >
                    {line.label}
                  </text>
                </g>
              );
            }

            return (
              <g key={line.pomKey} opacity={active ? 1 : 0.45}>
                <line
                  x1={line.x1}
                  y1={line.anchorYPx}
                  x2={line.x2}
                  y2={line.yPx}
                  stroke={stroke}
                  strokeWidth={
                    line.kind === "width"
                      ? Math.max(1.5, w / 350)
                      : Math.max(1, w / 500)
                  }
                  strokeDasharray={
                    line.kind === "width" ? undefined : `${w / 60} ${w / 120}`
                  }
                />
                <text
                  x={labelX}
                  y={line.anchorYPx - w / 120}
                  fill={styles.valueLabel}
                  fontSize={Math.max(10, w / 48)}
                  fontFamily="var(--font-martian-mono), monospace"
                >
                  {line.displayLabel}
                </text>
                <text
                  x={labelX}
                  y={line.anchorYPx + w / 36}
                  fill={styles.nameLabel}
                  fontSize={Math.max(8, w / 64)}
                  fontFamily="var(--font-sans), sans-serif"
                >
                  {line.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
