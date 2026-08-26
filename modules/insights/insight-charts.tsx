import type { ReactNode } from "react";

/** Brand-derived categorical palette (works on the light greige ground). */
export const CHART_COLORS = [
  "#b08d4c", // zari
  "#1b2547", // indigo
  "#8c2f39", // madder
  "#5f7360", // sage-ink
  "#8fa6b2", // chalk
  "#c9a25a", // light zari
];

export function ChartCard({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border border-indigo-lift bg-indigo-lift/20 p-4">
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
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="border border-indigo-lift bg-indigo-lift/20 px-4 py-4">
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

/** Horizontal bars — good for ranked lists (top designs, cities, categories). */
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
            <span className="truncate text-greige">{r.name}</span>
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

/** Vertical bars — good for ordered dimensions (size XS→XXL). */
export function VBars({
  rows,
  format,
}: {
  rows: { label: string; value: number; highlight?: boolean }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const W = 100 / Math.max(1, rows.length);
  return (
    <div className="flex items-end gap-2" style={{ height: 140 }}>
      {rows.map((r) => {
        const h = (r.value / max) * 100;
        return (
          <div
            key={r.label}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            style={{ width: `${W}%` }}
          >
            <span className="font-data text-[11px] text-chalk">
              {format ? format(r.value) : r.value}
            </span>
            <div
              className="w-full"
              style={{
                height: `${Math.max(2, h)}%`,
                backgroundColor: r.highlight ? CHART_COLORS[0] : "#1b2547",
                opacity: r.value > 0 ? 0.9 : 0.25,
              }}
              title={`${r.label}: ${r.value}`}
            />
            <span className="font-sans text-[10px] uppercase tracking-[0.06em] text-chalk">
              {r.label}
            </span>
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
        <circle cx="50" cy="50" r={R} fill="none" stroke="#00000010" strokeWidth="14" />
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
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
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
