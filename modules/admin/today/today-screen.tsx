import { Check } from "lucide-react";

import { Eyebrow } from "@/modules/ui";
import { can } from "@/modules/auth";
import type { PermissionKey } from "@aks/shared";

import { getTodayScreenData } from "./queries";
import { getOverviewCharts } from "./overview-charts";
import { OverviewRangePicker } from "./overview-range-picker";
import {
  OverviewSummaryRow,
  QuietLanes,
  TodayActionCards,
  TodayNumbers,
} from "./today-view";

type TodayScreenProps = {
  permissions: readonly PermissionKey[];
  from?: string;
  to?: string;
};

export async function TodayScreen({ permissions, from, to }: TodayScreenProps) {
  const granted = new Set(permissions);
  const { cards, stats, summary, allClear, range } = await getTodayScreenData(
    granted,
    { from, to },
  );
  const showRevenue = can(granted, "money.view");
  const showMargin =
    can(granted, "money.view") || can(granted, "designs.view");

  const charts = await getOverviewCharts({ from: range.from, to: range.to });

  const needsYou = cards.filter((c) => c.count > 0);
  const clearCards = cards.filter((c) => c.count === 0);
  const rangeLabel =
    range.fromKey === range.toKey
      ? range.fromKey
      : `${range.fromKey} → ${range.toKey}`;

  return (
    <div className="flex flex-col gap-9">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <Eyebrow className="text-ink/55">AKS · Admin</Eyebrow>
          <h1 className="mt-2 font-display text-[2.6rem] font-light leading-none text-ink">
            Overview
          </h1>
          <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-ink/55">
            What needs your attention right now — everything below is derived
            live from real order state.
          </p>
        </div>
        <OverviewRangePicker fromKey={range.fromKey} toKey={range.toKey} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-ink/55">
            Needs you
          </h2>
          {allClear ? (
            <span className="font-data text-[11px] text-ink/40">All clear</span>
          ) : (
            <span className="font-data text-[11px] text-madder">
              {needsYou.reduce((s, c) => s + c.count, 0)} open
            </span>
          )}
        </div>

        {allClear ? (
          <div className="flex flex-col items-center gap-3 border border-ink/12 bg-milk px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center bg-ink/[0.04]">
              <Check className="size-5 text-ink" />
            </span>
            <p className="font-display text-[1.3rem] font-light text-ink">
              All clear for now
            </p>
            <p className="max-w-sm text-[13px] text-ink/55">
              No orders, fabric, payments, or designs waiting on you.
            </p>
            <QuietLanes cards={clearCards} />
          </div>
        ) : (
          <TodayActionCards cards={cards} />
        )}
      </section>

      {stats ? (
        <TodayNumbers
          stats={stats}
          charts={charts}
          showRevenue={showRevenue}
          rangeLabel={rangeLabel}
        />
      ) : null}

      <OverviewSummaryRow summary={summary} showMargin={showMargin} />
    </div>
  );
}
