import Link from "next/link";

import { Money } from "@/modules/ui";
import { cn } from "@/lib/utils";

import type { TodayActionCard, TodayStats } from "./queries";

type TodayActionCardsProps = {
  cards: TodayActionCard[];
  /** Show checkmark empty state instead of zero count. */
  clear?: boolean;
};

export function TodayActionCards({ cards, clear = false }: TodayActionCardsProps) {
  if (cards.length === 0) {
    return (
      <p className="text-[13px] text-ink/55">
        No action queues are visible with your current permissions.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const alert = !clear && card.count > 0 && Boolean(card.hint);
        return (
          <li key={card.id}>
            <Link
              href={card.href}
              className={cn(
                "group relative flex min-h-[7.5rem] flex-col gap-2 border border-ink/12 bg-milk px-5 py-5 transition-colors hover:border-ink",
                alert && "border-s-2 border-s-madder",
              )}
            >
              <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-ink/55">
                {card.label}
              </p>
              {clear ? (
                <p className="mt-auto flex items-center gap-1.5 text-[12px] text-chalk">
                  <span aria-hidden>✓</span> None waiting
                </p>
              ) : (
                <>
                  {card.hint ? (
                    <p className="text-[11px] text-chalk">{card.hint}</p>
                  ) : null}
                  <p
                    className={cn(
                      "mt-auto font-display text-[2.6rem] leading-none text-ink",
                      alert && "text-madder",
                    )}
                  >
                    {card.count}
                  </p>
                </>
              )}
              <span
                className="absolute top-5 end-5 text-[14px] text-ink/40 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              >
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

type TodayStatsPanelProps = {
  stats: TodayStats;
  showRevenue: boolean;
};

export function TodayStatsPanel({ stats, showRevenue }: TodayStatsPanelProps) {
  const columnClass = showRevenue
    ? "sm:grid-cols-2 lg:grid-cols-4"
    : "sm:grid-cols-3";

  return (
    <div
      className={`grid gap-px overflow-hidden border border-ink/12 bg-ink/12 ${columnClass}`}
    >
      <StatItem label="Orders placed" value={String(stats.ordersPlaced)} />
      {showRevenue ? (
        <StatMoneyItem label="Revenue" minor={stats.revenueMinor} />
      ) : null}
      <StatItem label="In production" value={String(stats.inProduction)} />
      <StatItem
        label="Dispatched"
        value={String(stats.dispatchedInRange)}
      />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-milk px-5 py-4">
      <dt className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
        {label}
      </dt>
      <dd className="mt-2 font-data text-[1.15rem] text-ink">{value}</dd>
    </div>
  );
}

function StatMoneyItem({ label, minor }: { label: string; minor: number }) {
  return (
    <div className="bg-milk px-5 py-4">
      <dt className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
        {label}
      </dt>
      <dd className="mt-2 font-display text-[1.7rem] font-normal text-ink">
        <Money value={minor} />
      </dd>
    </div>
  );
}
