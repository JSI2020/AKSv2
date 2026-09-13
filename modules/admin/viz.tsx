import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Stacked metres: available (ink) + reserved (zari) on on-hand total. */
export function MetresTriadBar({
  onHand,
  reserved,
  available,
  reorderPoint = 0,
  className,
}: {
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint?: number;
  className?: string;
}) {
  const total = Math.max(onHand, 1);
  const availPct = Math.min(100, Math.round((available / total) * 100));
  const resPct = Math.min(100 - availPct, Math.round((reserved / total) * 100));
  const low = reorderPoint > 0 && available <= reorderPoint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="flex h-2 w-full overflow-hidden border border-ink/10 bg-greige"
        role="img"
        aria-label={`Available ${available}, reserved ${reserved}, on hand ${onHand}`}
      >
        <span
          className={cn("h-full", low ? "bg-madder" : "bg-ink")}
          style={{ width: `${availPct}%` }}
        />
        <span className="h-full bg-zari" style={{ width: `${resPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-data text-[10px] uppercase tracking-[0.06em] text-ink/55">
        <span>
          Avail{" "}
          <span className={low ? "text-madder" : "text-ink"}>
            {(available / 100).toFixed(2)}m
          </span>
        </span>
        <span>
          Res <span className="text-zari">{(reserved / 100).toFixed(2)}m</span>
        </span>
        <span>
          Hand <span className="text-ink/70">{(onHand / 100).toFixed(2)}m</span>
        </span>
      </div>
    </div>
  );
}

type CostSeg = { key: string; label: string; minor: number; tone: "ink" | "chalk" | "zari" | "madder" };

/** Cost composition → sell → margin band (paisa integers). */
export function CostStackBar({
  segments,
  sellMinor,
  costMinor,
  marginPercent,
  showMargin,
}: {
  segments: CostSeg[];
  sellMinor: number;
  costMinor: number;
  marginPercent: number;
  showMargin: boolean;
}) {
  const basis = Math.max(sellMinor, costMinor, 1);
  const toneClass = {
    ink: "bg-ink",
    chalk: "bg-chalk",
    zari: "bg-zari",
    madder: "bg-madder",
  } as const;

  const marginTone =
    marginPercent < 1500
      ? "text-madder"
      : marginPercent < 3000
        ? "text-zari"
        : "text-ink";

  return (
    <div className="flex flex-col gap-3 border border-ink/12 bg-greige/40 px-4 py-4">
      <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
        Cost stack
      </p>
      <div className="flex h-3 w-full overflow-hidden border border-ink/10 bg-milk">
        {segments
          .filter((s) => s.minor > 0)
          .map((s) => (
            <span
              key={s.key}
              className={cn("h-full", toneClass[s.tone])}
              style={{
                width: `${Math.max(2, Math.round((s.minor / basis) * 100))}%`,
              }}
              title={s.label}
            />
          ))}
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {segments
          .filter((s) => s.minor > 0)
          .map((s) => (
            <li
              key={s.key}
              className="flex items-center justify-between gap-2 text-[12px] text-ink/70"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn("size-2 shrink-0", toneClass[s.tone])}
                  aria-hidden
                />
                {s.label}
              </span>
              <span className="font-data tabular-nums text-ink">
                {formatPkr(s.minor)}
              </span>
            </li>
          ))}
      </ul>
      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-ink/10 pt-3">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
            Sell
          </p>
          <p className="font-data text-[15px] text-ink">{formatPkr(sellMinor)}</p>
        </div>
        <div className="text-end">
          <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
            Cost
          </p>
          <p className="font-data text-[15px] text-zari">{formatPkr(costMinor)}</p>
        </div>
        {showMargin ? (
          <div className="text-end">
            <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
              Margin
            </p>
            <p className={cn("font-data text-[15px]", marginTone)}>
              {(marginPercent / 100).toFixed(1)}%
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatPkr(minor: number): string {
  const rupees = Math.round(minor / 100);
  return `PKR ${rupees.toLocaleString("en-PK")}`;
}

/** Simple fill gauge 0–100 for hub tiles. */
export function HealthFill({
  healthy,
  low,
  label,
}: {
  healthy: number;
  low: number;
  label: ReactNode;
}) {
  const total = Math.max(healthy + low, 1);
  const okPct = Math.round((healthy / total) * 100);
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex h-1.5 w-full overflow-hidden bg-greige">
        <span className="h-full bg-ink" style={{ width: `${okPct}%` }} />
        <span
          className="h-full bg-madder"
          style={{ width: `${100 - okPct}%` }}
        />
      </div>
      <p className="font-data text-[11px] text-ink/55">{label}</p>
    </div>
  );
}

/** Light-ground spark bars for Overview (milk / ink). */
export function LightSparkBars({
  points,
  emptyLabel = "No activity in this range.",
}: {
  points: { key: string; label: string; value: number; title?: string }[];
  emptyLabel?: string;
}) {
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-ink/45">{emptyLabel}</p>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="flex h-[120px] items-end gap-1">
      {points.map((p) => {
        const h = p.value > 0 ? Math.max((p.value / max) * 100, 5) : 2;
        return (
          <div
            key={p.key}
            className="flex flex-1 flex-col items-center justify-end"
            title={p.title ?? `${p.label}: ${p.value}`}
          >
            <div
              className={cn(
                "w-full",
                p.value > 0 ? "bg-indigo" : "bg-ink/[0.08]",
              )}
              style={{ height: `${h}%` }}
            />
            <span className="mt-1 truncate text-[8px] text-ink/40">
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** SVG line chart for Overview revenue trend — indigo stroke, no fill. */
export function LightRevenueLine({
  points,
  emptyLabel = "No revenue in this range.",
}: {
  points: { key: string; label: string; value: number; title?: string }[];
  emptyLabel?: string;
}) {
  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-[12px] text-ink/45">{emptyLabel}</p>
    );
  }

  const W = 560;
  const H = 148;
  const padX = 10;
  const padY = 14;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const step = n <= 1 ? 0 : (W - padX * 2) / (n - 1);

  const coords = points.map((p, i) => {
    const x = padX + i * step;
    const y = H - padY - (p.value / max) * (H - padY * 2);
    return { x, y, ...p };
  });

  const poly = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const guides = [0.25, 0.5, 0.75].map((t) => padY + (1 - t) * (H - padY * 2));

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[148px] w-full"
        role="img"
        aria-label="Revenue trend"
      >
        {guides.map((y) => (
          <line
            key={y}
            x1={padX}
            x2={W - padX}
            y1={y}
            y2={y}
            stroke="#16181D"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}
        <polyline
          fill="none"
          stroke="#1B2547"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={poly}
        />
        {coords.map((c) =>
          c.value > 0 ? (
            <circle key={c.key} cx={c.x} cy={c.y} r="3.5" fill="#B08D4C">
              <title>{c.title ?? `${c.label}: ${c.value}`}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <div className="flex justify-between gap-1 px-1">
        {points.map((p, i) => {
          const show =
            points.length <= 10 ||
            i === 0 ||
            i === points.length - 1 ||
            i % Math.ceil(points.length / 8) === 0;
          return (
            <span
              key={p.key}
              className="flex-1 truncate text-center text-[9px] text-ink/40"
            >
              {show ? p.label : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
