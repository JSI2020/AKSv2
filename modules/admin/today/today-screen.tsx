import { Check } from "lucide-react";

import { Eyebrow } from "@/modules/ui";
import { can } from "@/modules/auth";
import type { PermissionKey } from "@aks/shared";

import { getTodayScreenData } from "./queries";
import { getOverviewCharts } from "./overview-charts";
import { OverviewChartsPanel } from "./overview-charts-panel";
import { OverviewRangePicker } from "./overview-range-picker";
import { TodayActionCards, TodayClearCards, TodayNumbers } from "./today-view";

type TodayScreenProps = {
  permissions: readonly PermissionKey[];
  from?: string;
  to?: string;
};

export async function TodayScreen({ permissions, from, to }: TodayScreenProps) {
  const granted = new Set(permissions);
  const { cards, stats, allClear, range } = await getTodayScreenData(granted, {
    from,
    to,
  });
  const showRevenue = can(granted, "money.view");

  const chartFrom = new Date(`${range.fromKey}T00:00:00`);
  const chartTo = new Date(`${range.toKey}T23:59:59`);
  const charts = await getOverviewCharts({ from: chartFrom, to: chartTo });

  const needsYou = cards.filter((c) => c.count > 0);
  const clearCards = cards.filter((c) => c.count === 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="text-ink/55">AKS · Admin</Eyebrow>
          <h1 className="mt-2 font-display text-[2.4rem] font-light leading-none text-ink">
            Overview
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] text-ink/55">
            What needs you right now — everything is live from orders, fabric,
            and studio. The numbers below follow the date range you pick.
          </p>
        </div>
        <OverviewRangePicker fromKey={range.fromKey} toKey={range.toKey} />
      </div>

      {allClear ? (
        <div className="flex flex-col items-center gap-3 border border-ink/12 bg-milk px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-ink/5">
            <Check className="size-6 text-ink" />
          </span>
          <p className="font-display text-[1.4rem] font-light text-ink">
            All clear for now
          </p>
          <p className="max-w-sm text-[13px] text-ink/55">
            No orders, fabric, payments, or designs waiting on you. Enjoy the
            quiet — the period numbers are below.
          </p>
        </div>
      ) : (
        <>
          {needsYou.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/55">
                Needs you
              </h2>
              <TodayActionCards cards={needsYou} />
            </section>
          ) : null}
          {clearCards.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/55">
                All clear
              </h2>
              <TodayClearCards cards={clearCards} />
            </section>
          ) : null}
        </>
      )}

      {stats ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Numbers · {range.fromKey}
            {range.fromKey === range.toKey ? "" : ` → ${range.toKey}`}
          </h2>
          <TodayNumbers stats={stats} charts={charts} showRevenue={showRevenue} />
        </section>
      ) : null}

      <OverviewChartsPanel data={charts} showRevenue={showRevenue} />
    </div>
  );
}
