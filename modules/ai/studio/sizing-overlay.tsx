"use client";

import type { OverlayGuideLine } from "@/modules/ai/studio/sizing/overlay-math";

type Props = {
  heroUrl: string;
  imageWidthPx: number;
  imageHeightPx: number;
  lines: OverlayGuideLine[];
  highlightKey?: string | null;
};

export function SizingOverlay({
  heroUrl,
  imageWidthPx,
  imageHeightPx,
  lines,
  highlightKey = null,
}: Props) {
  const w = imageWidthPx > 0 ? imageWidthPx : 768;
  const h = imageHeightPx > 0 ? imageHeightPx : 1024;
  const aspect = `${w} / ${h}`;

  return (
    <div
      className="relative w-full overflow-hidden border border-indigo-lift bg-indigo-lift"
      style={{ aspectRatio: aspect }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={heroUrl}
        alt=""
        className="absolute inset-0 size-full object-contain"
      />
      <svg
        className="pointer-events-none absolute inset-0 size-full"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {lines.map((line) => {
          const active =
            !highlightKey || highlightKey === line.measurementKey;
          const stroke = active ? "#8FA6B2" : "#8FA6B280";
          const strokeW = Math.max(1, w / 400);

          if (line.direction === "down") {
            return (
              <g key={line.measurementKey} opacity={active ? 1 : 0.45}>
                <line
                  x1={w * 0.72}
                  y1={line.anchorYPx}
                  x2={w * 0.72}
                  y2={line.yPx}
                  stroke={stroke}
                  strokeWidth={strokeW}
                  strokeDasharray={`${w / 80} ${w / 160}`}
                />
                <line
                  x1={w * 0.68}
                  y1={line.yPx}
                  x2={w * 0.76}
                  y2={line.yPx}
                  stroke={stroke}
                  strokeWidth={Math.max(1, w / 500)}
                />
                <text
                  x={w * 0.77}
                  y={line.yPx - w / 120}
                  fill="#8FA6B2"
                  fontSize={Math.max(10, w / 48)}
                  fontFamily="var(--font-martian-mono), monospace"
                >
                  {line.displayLabel}
                </text>
                <text
                  x={w * 0.77}
                  y={line.yPx + w / 36}
                  fill="#DCD9CF"
                  fontSize={Math.max(8, w / 64)}
                  fontFamily="var(--font-sans), sans-serif"
                >
                  {line.label}
                </text>
              </g>
            );
          }

          return (
            <g key={line.measurementKey} opacity={active ? 1 : 0.45}>
              <line
                x1={w * 0.2}
                y1={line.anchorYPx}
                x2={w * 0.8}
                y2={line.anchorYPx}
                stroke={stroke}
                strokeWidth={Math.max(1, w / 500)}
                strokeDasharray={`${w / 60} ${w / 120}`}
              />
              <text
                x={w * 0.82}
                y={line.anchorYPx - w / 120}
                fill="#8FA6B2"
                fontSize={Math.max(10, w / 48)}
                fontFamily="var(--font-martian-mono), monospace"
              >
                {line.displayLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
