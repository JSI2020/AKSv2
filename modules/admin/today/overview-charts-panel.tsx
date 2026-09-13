import { Money } from "@/modules/ui";
import { cn } from "@/lib/utils";

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
  accent = "ink",
}: {
  title: string;
  rows: NamedValue[];
  showRevenue: boolean;
  accent?: "ink" | "zari";
}) {
  const max = Math.max(1, ...rows.map((r) => r.revenueMinor));
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 border border-dashed border-ink/12 bg-greige/30 px-4 py-10 text-center">
          <p className="text-[13px] text-ink/55">No sales in this range yet</p>
          <p className="max-w-xs text-[11px] text-ink/40">
            Pick a wider window or wait for the next placed order.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <li key={r.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="truncate text-ink/80">
                  <span className="me-2 font-data text-[10px] text-ink/35">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {r.name}
                </span>
                <span className="shrink-0 font-data text-ink/60">
                  {showRevenue ? (
                    <Money value={r.revenueMinor} />
                  ) : (
                    `${r.units} u`
                  )}
                </span>
              </div>
              <div className="h-1.5 w-full bg-ink/8">
                <div
                  className={cn(
                    "h-1.5",
                    accent === "zari" ? "bg-zari" : "bg-ink/50",
                  )}
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
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Business at a glance
        </h2>
        <span className="text-[11px] text-ink/40">Selected range</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <BarList
          title="Top designs"
          rows={data.topDesigns}
          showRevenue={showRevenue}
          accent="ink"
        />
        <BarList
          title="By category"
          rows={data.byCategory}
          showRevenue={showRevenue}
          accent="zari"
        />
      </div>
    </section>
  );
}
