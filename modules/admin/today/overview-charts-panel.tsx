import { Money } from "@/modules/ui";

import type { NamedValue, OverviewCharts } from "./overview-charts";

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border border-ink/12 bg-milk p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
          {title}
        </h3>
        {hint ? (
          <span className="font-data text-[11px] text-ink/45">{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RevenueTrend({
  points,
  showRevenue,
}: {
  points: OverviewCharts["dailyRevenue"];
  showRevenue: boolean;
}) {
  const max = Math.max(1, ...points.map((p) => p.revenueMinor));
  const total = points.reduce((s, p) => s + p.revenueMinor, 0);
  const orders = points.reduce((s, p) => s + p.orders, 0);
  const W = 320;
  const H = 96;
  const gap = 4;
  const bw = (W - gap * (points.length - 1)) / points.length;

  return (
    <Panel
      title="Revenue · last 14 days"
      hint={showRevenue ? undefined : "hidden"}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-[1.8rem] font-light leading-none text-ink">
            {showRevenue ? <Money value={total} /> : "—"}
          </p>
          <p className="mt-1 text-[12px] text-ink/55">
            {orders} order{orders === 1 ? "" : "s"} placed
          </p>
        </div>
      </div>
      {showRevenue ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-1 h-24 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Daily revenue, last 14 days"
        >
          {points.map((p, i) => {
            const h = Math.max(1, (p.revenueMinor / max) * (H - 6));
            const x = i * (bw + gap);
            const y = H - h;
            return (
              <rect
                key={p.day}
                x={x}
                y={y}
                width={bw}
                height={h}
                rx={1}
                className="fill-current text-zari"
                opacity={p.revenueMinor > 0 ? 0.9 : 0.25}
              >
                <title>{`${p.day}: ${(p.revenueMinor / 100).toLocaleString()} · ${p.orders} orders`}</title>
              </rect>
            );
          })}
        </svg>
      ) : (
        <p className="py-6 text-center text-[12px] text-ink/45">
          You don’t have access to revenue figures.
        </p>
      )}
    </Panel>
  );
}

function BarList({
  title,
  rows,
  showRevenue,
}: {
  title: string;
  rows: NamedValue[];
  showRevenue: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.revenueMinor));
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-ink/45">
          No sales in this range yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="truncate text-ink/80">{r.name}</span>
                <span className="shrink-0 font-data text-ink/60">
                  {showRevenue ? <Money value={r.revenueMinor} /> : `${r.units}`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-ink/8">
                <div
                  className="h-1.5 bg-ink/45"
                  style={{
                    width: `${Math.max(3, (r.revenueMinor / max) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function OverviewChartsPanel({
  data,
  showRevenue,
}: {
  data: OverviewCharts;
  showRevenue: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/55">
        Business at a glance
      </h2>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
        <RevenueTrend points={data.dailyRevenue} showRevenue={showRevenue} />
        <BarList
          title="Top designs"
          rows={data.topDesigns}
          showRevenue={showRevenue}
        />
        <BarList
          title="By category"
          rows={data.byCategory}
          showRevenue={showRevenue}
        />
      </div>
    </section>
  );
}
