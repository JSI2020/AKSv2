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
      <div className="grid gap-3 lg:grid-cols-2">
        <BarList
          title="Top designs by revenue"
          rows={data.topDesigns}
          showRevenue={showRevenue}
        />
        <BarList
          title="Revenue by category"
          rows={data.byCategory}
          showRevenue={showRevenue}
        />
      </div>
    </section>
  );
}
