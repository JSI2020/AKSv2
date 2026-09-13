import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  Layers,
  Package,
  Palette,
  Ruler,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Money } from "@/modules/ui";
import { cn } from "@/lib/utils";
import { LightRevenueLine } from "@/modules/admin/viz";

import type {
  OverviewSummary,
  TodayActionCard,
  TodayStats,
} from "./queries";
import type { OverviewCharts } from "./overview-charts";

type CardMeta = {
  icon: LucideIcon;
  alert?: boolean;
  money?: boolean;
  priority: number;
};

const CARD_META: Record<string, CardMeta> = {
  "at-risk": { icon: AlertTriangle, alert: true, priority: 0 },
  "balance-due": { icon: Wallet, alert: true, money: true, priority: 1 },
  "low-stock": { icon: Layers, alert: true, priority: 2 },
  "awaiting-confirmation": { icon: ShoppingBag, priority: 3 },
  "measurements-unverified": { icon: Ruler, priority: 4 },
  "bank-transfer": { icon: Building2, money: true, priority: 5 },
  "designs-review": { icon: Palette, priority: 6 },
};

function metaFor(id: string): CardMeta {
  return CARD_META[id] ?? { icon: ShoppingBag, priority: 99 };
}

function sortCards(cards: TodayActionCard[]): TodayActionCard[] {
  return [...cards].sort((a, b) => {
    const ma = metaFor(a.id);
    const mb = metaFor(b.id);
    // Active alerts first, then other active, then quiet
    const aHot = a.count > 0 ? 0 : 1;
    const bHot = b.count > 0 ? 0 : 1;
    if (aHot !== bHot) return aHot - bHot;
    return ma.priority - mb.priority;
  });
}

/**
 * Needs-you grid — mockup layout with circular icon wells.
 * Alerts: madder start-rail + madder count. Sorted by urgency.
 */
export function TodayActionCards({ cards }: { cards: TodayActionCard[] }) {
  if (cards.length === 0) {
    return (
      <p className="text-[13px] text-ink/55">
        No action queues are visible with your current permissions.
      </p>
    );
  }
  const ordered = sortCards(cards);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ordered.map((card) => {
        const { icon: Icon, alert, money } = metaFor(card.id);
        const isAlert = Boolean(alert) && card.count > 0;
        const isMoney = Boolean(money) && card.count > 0 && !isAlert;
        const quiet = card.count === 0;
        return (
          <Link
            key={card.id}
            href={card.href}
            className={cn(
              "group flex items-center gap-3.5 border bg-milk px-4 py-4 transition-colors hover:border-ink/30",
              isAlert
                ? "border-ink/10 border-s-[3px] border-s-madder"
                : "border-ink/10",
              quiet && "opacity-50",
            )}
          >
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center",
                isAlert
                  ? "bg-madder/10"
                  : isMoney
                    ? "bg-zari/15"
                    : "bg-ink/[0.05]",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px]",
                  isAlert
                    ? "text-madder"
                    : isMoney
                      ? "text-zari"
                      : "text-ink/45",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug text-ink">
                {card.label}
              </p>
              {card.hint ? (
                <p className="mt-0.5 text-[11.5px] leading-snug text-ink/45">
                  {card.hint}
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "shrink-0 font-display text-[2rem] font-light leading-none tabular-nums",
                isAlert
                  ? "text-madder"
                  : quiet
                    ? "text-ink/25"
                    : "text-ink",
              )}
            >
              {card.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function QuietLanes({ cards }: { cards: TodayActionCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {cards.map((card) => {
        const { icon: Icon } = metaFor(card.id);
        return (
          <span
            key={card.id}
            className="inline-flex items-center gap-2 border border-ink/10 bg-milk px-3 py-1.5 text-[11.5px] text-ink/55"
          >
            <Icon className="size-3.5 text-chalk" />
            {card.label}
            <Check className="size-3 text-ink/40" />
          </span>
        );
      })}
    </div>
  );
}

export function TodayClearCards({ cards }: { cards: TodayActionCard[] }) {
  return <QuietLanes cards={cards} />;
}

/** Pipeline column with a vertical stem — clearer than three loose cards. */
function PipelineColumn({
  stats,
  rangeLabel,
}: {
  stats: TodayStats;
  rangeLabel: string;
}) {
  const steps: {
    label: string;
    value: number;
    hint: string;
    icon: LucideIcon;
  }[] = [
    {
      label: "Orders placed",
      value: stats.ordersPlaced,
      hint: rangeLabel,
      icon: ShoppingBag,
    },
    {
      label: "In production",
      value: stats.inProduction,
      hint: "Currently in workshop",
      icon: Package,
    },
    {
      label: "Dispatched",
      value: stats.dispatchedInRange,
      hint: "Out for delivery",
      icon: Truck,
    },
  ];

  return (
    <div className="relative flex flex-col gap-3">
      {/* Stem behind the tiles */}
      <span
        className="pointer-events-none absolute start-5 top-6 bottom-6 w-px bg-ink/12"
        aria-hidden
      />
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <div
            key={step.label}
            className="relative flex items-center gap-3 border border-ink/12 bg-milk px-4 py-4"
          >
            <div className="relative z-[1] flex size-9 shrink-0 items-center justify-center bg-ink/[0.05]">
              <Icon className="size-4 text-ink/45" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/50">
                {step.label}
              </p>
              <p className="mt-0.5 font-data text-[1.4rem] leading-none text-ink">
                {step.value}
              </p>
              <p className="mt-1 text-[11px] text-ink/45">{step.hint}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Middle band: revenue line (2/3) + pipeline stem (1/3).
 */
export function TodayNumbers({
  stats,
  charts,
  showRevenue,
  rangeLabel,
}: {
  stats: TodayStats;
  charts: OverviewCharts;
  showRevenue: boolean;
  rangeLabel: string;
}) {
  const trend = charts.dailyRevenue;
  const total = trend.reduce((s, d) => s + d.revenueMinor, 0);
  const orders = trend.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <section className="flex flex-col border border-ink/12 bg-milk p-5 lg:col-span-2">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/50">
              Revenue trend
            </p>
            <p className="mt-1.5 font-display text-[2.1rem] font-light leading-none text-ink">
              {showRevenue ? <Money value={total} /> : "—"}
            </p>
            <p className="mt-1.5 text-[12px] text-ink/50">
              {rangeLabel} · {orders} order{orders === 1 ? "" : "s"} total
            </p>
          </div>
          <TrendingUp className="size-5 text-zari" aria-hidden />
        </div>
        {showRevenue ? (
          <div className="mt-auto">
            <LightRevenueLine
              points={trend.map((d) => {
                const rupees = (d.revenueMinor / 100).toLocaleString();
                return {
                  key: d.day,
                  label: d.day.slice(8),
                  value: d.revenueMinor,
                  title: `${d.day}: ${rupees} · ${d.orders} orders`,
                };
              })}
            />
          </div>
        ) : (
          <p className="flex flex-1 items-center justify-center py-12 text-[12px] text-ink/45">
            You do not have access to revenue figures.
          </p>
        )}
      </section>

      <PipelineColumn stats={stats} rangeLabel={rangeLabel} />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  href,
  accent,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/50">
          {label}
        </p>
        <span
          className={cn(
            "flex size-8 items-center justify-center",
            accent ? "bg-zari/15" : "bg-ink/[0.05]",
          )}
        >
          <Icon
            className={cn("size-4", accent ? "text-zari" : "text-ink/40")}
            aria-hidden
          />
        </span>
      </div>
      <p className="mt-4 font-display text-[2.15rem] font-light leading-none text-ink">
        {value}
      </p>
    </>
  );

  const className =
    "block border border-ink/12 bg-milk px-5 py-5 transition-colors hover:border-ink/25";

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function OverviewSummaryRow({
  summary,
  showMargin,
}: {
  summary: OverviewSummary;
  showMargin: boolean;
}) {
  const margin =
    showMargin && summary.avgMarginPercent !== null
      ? `${(summary.avgMarginPercent / 100).toFixed(1)}%`
      : "—";

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryTile
        label="Published designs"
        value={summary.publishedDesigns}
        icon={Palette}
        href="/admin/designs?status=PUBLISHED"
      />
      <SummaryTile
        label="Active customers"
        value={summary.activeCustomers}
        icon={Users}
        href="/admin/customers"
      />
      <SummaryTile
        label="Avg margin"
        value={margin}
        icon={TrendingUp}
        accent={showMargin && summary.avgMarginPercent !== null}
      />
    </div>
  );
}
