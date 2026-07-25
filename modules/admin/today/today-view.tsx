import Link from "next/link";

import { Money } from "@/modules/ui";

import type { TodayActionCard, TodayStats } from "./queries";

type TodayActionCardsProps = {
  cards: TodayActionCard[];
};

export function TodayActionCards({ cards }: TodayActionCardsProps) {
  if (cards.length === 0) {
    return (
      <p className="text-[13px] text-chalk">
        No action queues are visible with your current permissions.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <li key={card.id}>
          <Link
            href={card.href}
            className="flex min-h-[7rem] flex-col justify-between border border-indigo-lift px-4 py-3 hover:bg-indigo-lift/40"
          >
            <div>
              <p className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
                {card.label}
              </p>
              {card.hint ? (
                <p className="mt-0.5 text-[12px] text-chalk/80">{card.hint}</p>
              ) : null}
            </div>
            <p className="mt-3 font-display text-4xl text-greige">{card.count}</p>
          </Link>
        </li>
      ))}
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
    <div className="border border-indigo-lift">
      <div className="border-b border-indigo-lift px-4 py-2">
        <p className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
          Today&apos;s numbers
        </p>
      </div>
      <dl className={`grid gap-px bg-indigo-lift ${columnClass}`}>
        <StatItem label="Orders placed" value={String(stats.ordersPlaced)} />
        {showRevenue ? (
          <StatMoneyItem label="Revenue" minor={stats.revenueMinor} />
        ) : null}
        <StatItem label="In production" value={String(stats.inProduction)} />
        <StatItem
          label="Dispatched today"
          value={String(stats.dispatchedToday)}
        />
      </dl>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-indigo px-4 py-3">
      <dt className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl text-greige">{value}</dd>
    </div>
  );
}

function StatMoneyItem({ label, minor }: { label: string; minor: number }) {
  return (
    <div className="bg-indigo px-4 py-3">
      <dt className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl text-greige">
        <Money value={minor} />
      </dd>
    </div>
  );
}
