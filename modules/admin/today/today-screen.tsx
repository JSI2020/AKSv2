import { EmptyState, Eyebrow } from "@/modules/ui";
import { can } from "@/modules/auth";
import type { PermissionKey } from "@aks/shared";

import { getTodayScreenData } from "./queries";
import { OverviewRangePicker } from "./overview-range-picker";
import { TodayActionCards, TodayStatsPanel } from "./today-view";

type TodayScreenProps = {
  permissions: readonly PermissionKey[];
  from?: string;
  to?: string;
};

export async function TodayScreen({
  permissions,
  from,
  to,
}: TodayScreenProps) {
  const granted = new Set(permissions);
  const { cards, stats, allClear, range } = await getTodayScreenData(granted, {
    from,
    to,
  });
  const showRevenue = can(granted, "money.view");
  const singleDay = range.fromKey === range.toKey;

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
            What needs you right now — every count is live from orders, fabric,
            and studio state. Numbers below follow the date range you pick.
          </p>
        </div>
        <OverviewRangePicker fromKey={range.fromKey} toKey={range.toKey} />
      </div>

      {allClear ? (
        <EmptyState
          tone="on-greige"
          title="All clear for now"
          description="No orders, fabric, payments, or designs waiting on you. Enjoy the quiet — period numbers are below."
        />
      ) : (
        <>
          {needsYou.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/55">
                Needs attention
              </h2>
              <TodayActionCards cards={needsYou} />
            </section>
          ) : null}
          {clearCards.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/55">
                All clear
              </h2>
              <TodayActionCards cards={clearCards} clear />
            </section>
          ) : null}
        </>
      )}

      {stats ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/55">
            {singleDay
              ? `Numbers · ${range.fromKey}`
              : `Numbers · ${range.fromKey} → ${range.toKey}`}
          </h2>
          <TodayStatsPanel stats={stats} showRevenue={showRevenue} />
        </section>
      ) : null}
    </div>
  );
}
