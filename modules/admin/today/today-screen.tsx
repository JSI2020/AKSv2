import { EmptyState, Eyebrow } from "@/modules/ui";
import { can } from "@/modules/auth";
import type { PermissionKey } from "@aks/shared";

import { getTodayScreenData } from "./queries";
import { TodayActionCards, TodayStatsPanel } from "./today-view";

type TodayScreenProps = {
  permissions: readonly PermissionKey[];
};

export async function TodayScreen({ permissions }: TodayScreenProps) {
  const granted = new Set(permissions);
  const { cards, stats, allClear } = await getTodayScreenData(granted);
  const showRevenue = can(granted, "money.view");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>AKS · admin</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">Today</h1>
        <p className="mt-1 max-w-xl text-[13px] text-chalk">
          What needs you right now — every count is live from orders, fabric, and
          studio state.
        </p>
      </div>

      {allClear ? (
        <EmptyState
          title="All clear for now"
          description="No orders, fabric, payments, or designs waiting on you. Enjoy the quiet — today's numbers are below."
        />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
            Needs attention
          </h2>
          <TodayActionCards cards={cards} />
        </section>
      )}

      {stats ? (
        <section className="flex flex-col gap-3">
          <TodayStatsPanel stats={stats} showRevenue={showRevenue} />
        </section>
      ) : null}
    </div>
  );
}
