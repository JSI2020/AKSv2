import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Six-colour admin palette only — no off-brand accents. */
export const CHART_COLORS = [
  "#B08D4C", // zari
  "#1B2547", // indigo
  "#8C2F39", // madder
  "#8FA6B2", // chalk
  "#16181D", // ink
  "#DCD9CF", // greige
] as const;

export function ChartCard({
  title,
  hint,
  icon,
  children,
  className,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 border border-indigo-lift bg-indigo-lift/20 p-4",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.14em] text-chalk">
          {icon ? <span className="text-zari">{icon}</span> : null}
          {title}
        </h2>
        {hint ? <span className="text-[11px] text-chalk">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Optional start rail — madder / zari / chalk. */
  accent?: "madder" | "zari" | "chalk";
}) {
  return (
    <div
      className={cn(
        "border border-indigo-lift bg-indigo-lift/20 px-4 py-4",
        accent === "madder" && "border-s-[3px] border-s-madder",
        accent === "zari" && "border-s-[3px] border-s-zari",
        accent === "chalk" && "border-s-[3px] border-s-chalk",
      )}
    >
      <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-chalk">
        {label}
      </p>
      <p className="mt-2 font-display text-[1.9rem] font-light leading-none text-greige">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[12px] text-chalk">{sub}</p> : null}
    </div>
  );
}

/** Horizontal bars — ranked lists (top designs, cities, categories). */
export function HBars({
  rows,
  format,
  emptyLabel = "No data in this range yet.",
}: {
  rows: { name: string; value: number; sub?: string }[];
  format: (v: number) => ReactNode;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[12px] text-chalk">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <li key={r.name} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="truncate text-greige">
              {r.name}
              {r.sub ? (
                <span className="ms-2 text-[11px] text-chalk">{r.sub}</span>
              ) : null}
            </span>
            <span className="shrink-0 font-data text-chalk">{format(r.value)}</span>
          </div>
          <div className="h-2 w-full bg-indigo-lift/50">
            <div
              className="h-2"
              style={{
                width: `${Math.max(3, (r.value / max) * 100)}%`,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars — ordered dimensions (size XS→XXL) or daily spark. */
export function VBars({
  rows,
  format,
  height = 140,
}: {
  rows: { label: string; value: number; highlight?: boolean; title?: string }[];
  format?: (v: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const W = 100 / Math.max(1, rows.length);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {rows.map((r) => {
        const h = (r.value / max) * 100;
        return (
          <div
            key={r.label}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            style={{ width: `${W}%` }}
            title={r.title ?? `${r.label}: ${r.value}`}
          >
            <span className="font-data text-[10px] text-chalk">
              {format ? format(r.value) : r.value || ""}
            </span>
            <div
              className="w-full"
              style={{
                height: `${Math.max(2, h)}%`,
                backgroundColor: r.highlight ? CHART_COLORS[0] : CHART_COLORS[1],
                opacity: r.value > 0 ? 0.92 : 0.22,
              }}
            />
            <span className="truncate font-sans text-[9px] uppercase tracking-[0.06em] text-chalk">
              {r.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact daily / spark bars for Trends. */
export function SparkBars({
  points,
  emptyLabel = "No activity in this range.",
}: {
  points: { key: string; label: string; value: number; title?: string }[];
  emptyLabel?: string;
}) {
  if (points.length === 0) {
    return <p className="py-8 text-center text-[12px] text-chalk">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="flex h-[120px] items-end gap-1">
      {points.map((p) => {
        const h = p.value > 0 ? Math.max((p.value / max) * 100, 5) : 2;
        return (
          <div
            key={p.key}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={p.title ?? `${p.label}: ${p.value}`}
          >
            <div
              className="w-full bg-zari"
              style={{
                height: `${h}%`,
                opacity: p.value > 0 ? 0.95 : 0.2,
              }}
            />
            <span className="mt-1 truncate text-[8px] text-chalk">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Donut — share of a whole (category / size-mode split). */
export function Donut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number }[];
  centerLabel?: string;
  centerValue?: ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="rgba(143,166,178,0.25)"
          strokeWidth="14"
        />
        {total > 0
          ? segments.map((s, i) => {
              const frac = s.value / total;
              const len = frac * C;
              const el = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth="14"
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })
          : null}
      </svg>
      <div className="min-w-0 flex-1">
        {centerValue !== undefined ? (
          <p className="mb-2 font-display text-[1.5rem] font-light leading-none text-greige">
            {centerValue}
            {centerLabel ? (
              <span className="ms-2 text-[12px] text-chalk">{centerLabel}</span>
            ) : null}
          </p>
        ) : null}
        <ul className="flex flex-col gap-1.5">
          {segments.map((s, i) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-3 text-[12px]"
            >
              <span className="flex items-center gap-2 truncate text-greige">
                <span
                  className="inline-block size-2.5 shrink-0"
                  style={{
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
                {s.label}
              </span>
              <span className="font-data text-chalk">
                {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Horizontal stack for % splits (e.g. size mode). */
export function StackSplit({
  segments,
  emptyLabel = "No units in this range.",
}: {
  segments: { label: string; value: number; percent: number }[];
  emptyLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return <p className="py-6 text-center text-[12px] text-chalk">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden border border-indigo-lift">
        {segments.map((s, i) =>
          s.value > 0 ? (
            <span
              key={s.label}
              className="h-full"
              style={{
                width: `${Math.max(2, (s.value / total) * 100)}%`,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
              title={`${s.label}: ${s.percent}%`}
            />
          ) : null,
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {segments.map((s, i) => (
          <li
            key={s.label}
            className="flex items-center justify-between gap-2 text-[12px]"
          >
            <span className="flex items-center gap-2 text-greige">
              <span
                className="size-2 shrink-0"
                style={{
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
              {s.label}
            </span>
            <span className="font-data text-chalk">
              {s.percent}% · {s.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PROVINCE_LABELS: Record<string, string> = {
  PUNJAB: "Punjab",
  SINDH: "Sindh",
  KPK: "Khyber Pakhtunkhwa",
  BALOCHISTAN: "Balochistan",
  GILGIT_BALTISTAN: "Gilgit-Baltistan",
  AJK: "Azad Kashmir",
  ICT: "Islamabad",
};

const PROVINCE_ORDER = [
  "PUNJAB",
  "SINDH",
  "KPK",
  "BALOCHISTAN",
  "GILGIT_BALTISTAN",
  "AJK",
  "ICT",
] as const;

/** Pakistan province intensity board — solid fills only (opacity via discrete steps). */
export function ProvinceBoard({
  rows,
  format,
  emptyLabel = "No provincial sales in this range.",
}: {
  rows: { province: string; revenueMinor: number; orderCount: number }[];
  format: (v: number) => ReactNode;
  emptyLabel?: string;
}) {
  const byKey = new Map(rows.map((r) => [r.province.toUpperCase(), r]));
  const max = Math.max(1, ...rows.map((r) => r.revenueMinor));
  const hasAny = rows.some((r) => r.revenueMinor > 0 || r.orderCount > 0);

  if (!hasAny) {
    return <p className="py-8 text-center text-[12px] text-chalk">{emptyLabel}</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {PROVINCE_ORDER.map((key) => {
        const hit = byKey.get(key);
        const revenue = hit?.revenueMinor ?? 0;
        const orders = hit?.orderCount ?? 0;
        const share = revenue / max;
        // Discrete intensity steps — chalk → indigo → zari → madder (no gradients)
        const tone =
          revenue === 0
            ? "bg-indigo-lift/30 text-chalk"
            : share < 0.25
              ? "bg-chalk/25 text-greige"
              : share < 0.5
                ? "bg-indigo/40 text-greige"
                : share < 0.75
                  ? "bg-zari/35 text-greige"
                  : "bg-madder/40 text-greige";
        return (
          <div
            key={key}
            className={cn(
              "flex min-h-[88px] flex-col justify-between border border-indigo-lift p-3",
              tone,
            )}
          >
            <p className="font-sans text-[10px] uppercase tracking-[0.12em]">
              {PROVINCE_LABELS[key] ?? key}
            </p>
            <div>
              <p className="font-data text-[14px] leading-tight">
                {revenue > 0 ? format(revenue) : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-chalk">
                {orders} order{orders === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { PROVINCE_LABELS, PROVINCE_ORDER };

/** Simple 0–100 progress rail for ops KPIs. */
export function ProgressRail({
  label,
  percent,
  hint,
  tone = "zari",
}: {
  label: string;
  percent: number;
  hint?: string;
  tone?: "zari" | "madder" | "chalk" | "ink";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const fill =
    tone === "madder"
      ? "bg-madder"
      : tone === "chalk"
        ? "bg-chalk"
        : tone === "ink"
          ? "bg-ink"
          : "bg-zari";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] text-greige">{label}</span>
        <span className="font-data text-[13px] text-chalk">{pct}%</span>
      </div>
      <div className="h-2 w-full bg-indigo-lift/50">
        <div className={cn("h-2", fill)} style={{ width: `${pct}%` }} />
      </div>
      {hint ? <p className="text-[11px] text-chalk">{hint}</p> : null}
    </div>
  );
}
