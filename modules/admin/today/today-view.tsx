import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Layers,
  Package,
  Palette,
  Ruler,
  ShoppingBag,
  TrendingUp,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Money } from "@/modules/ui";
import { cn } from "@/lib/utils";

import type { TodayActionCard, TodayStats } from "./queries";
import type { OverviewCharts } from "./overview-charts";

/** Card id → icon + whether it reads as an alert when it has a count. */
const CARD_META: Record<string, { icon: LucideIcon; alert?: boolean }> = {
  "awaiting-confirmation": { icon: ShoppingBag },
  "measurements-unverified": { icon: Ruler },
  "at-risk": { icon: AlertTriangle, alert: true },
  "balance-due": { icon: Wallet, alert: true },
  "low-stock": { icon: Layers, alert: true },
  "bank-transfer": { icon: Building2 },
  "designs-review": { icon: Palette },
};

function metaFor(id: string) {
  return CARD_META[id] ?? { icon: ShoppingBag };
}

/** "Needs you" — icon tiles, alert cards carry a madder rail. */
export function TodayActionCards({ cards }: { cards: TodayActionCard[] }) {
  if (cards.length === 0) {
    return (
      <p className="text-[13px] text-ink/55">
        No action queues are visible with your current permissions.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const { icon: Icon, alert } = metaFor(card.id);
        const on = Boolean(alert) && card.count > 0;
        return (
          <Link
            key={card.id}
            href={card.href}
            className={cn(
              "group flex items-center gap-4 border bg-milk p-4 transition-colors hover:border-ink/25",
              on ? "border-ink/10 border-s-[3px] border-s-madder" : "border-ink/10",
            )}
          >
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center",
                on ? "bg-madder/10" : "bg-ink/[0.05]",
              )}
            >
              <Icon className={cn("size-5", on ? "text-madder" : "text-ink/45")} />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="text-[12.5px] font-medium text-ink">{card.label}</p>
              {card.hint ? (
                <p className="text-[11px] text-ink/50">{card.hint}</p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={cn(
                  "font-display text-[2rem] font-light leading-none",
                  on ? "text-madder" : "text-ink",
                )}
              >
                {card.count}
              </span>
              <ArrowRight className="size-3 text-ink/40 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** "All clear" — compact reassurance rows. */
export function TodayClearCards({ cards }: { cards: TodayActionCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const { icon: Icon } = metaFor(card.id);
        return (
          <div
            key={card.id}
            className="flex items-center gap-3 border border-ink/8 bg-milk/60 px-3 py-2.5"
          >
            <Icon className="size-4 text-chalk" />
            <p className="flex-1 text-[11.5px] text-ink/65">{card.label}</p>
            <Check className="size-3.5 text-ink" />
          </div>
        );
      })}
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-4 border border-ink/12 bg-milk px-4 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center bg-ink/[0.05]">
        <Icon className="size-5 text-ink/45" />
      </div>
      <div className="flex-1">
        <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/50">
          {label}
        </p>
        <p className="font-data text-[1.35rem] leading-tight text-ink">{value}</p>
        <p className="text-[10px] text-ink/45">{hint}</p>
      </div>
    </div>
  );
}

/** Revenue trend (2-col) + the three flow KPIs beside it. */
export function TodayNumbers({
  stats,
  charts,
  showRevenue,
}: {
  stats: TodayStats;
  charts: OverviewCharts;
  showRevenue: boolean;
}) {
  const trend = charts.dailyRevenue;
  const max = Math.max(1, ...trend.map((d) => d.revenueMinor));
  const total = trend.reduce((s, d) => s + d.revenueMinor, 0);
  const orders = trend.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <section className="flex flex-col border border-ink/12 bg-milk p-5 lg:col-span-2">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/50">
              Revenue trend
            </p>
            <p className="mt-1 font-display text-[1.9rem] font-light leading-none text-ink">
              {showRevenue ? <Money value={total} /> : "—"}
            </p>
            <p className="mt-1 text-[11px] text-ink/50">
              Last 14 days · {orders} order{orders === 1 ? "" : "s"}
            </p>
          </div>
          <TrendingUp className="size-5 text-jade" />
        </div>
        {showRevenue ? (
          <>
            <div className="flex h-[120px] items-end gap-1.5">
              {trend.map((d) => {
                const h = d.revenueMinor > 0 ? Math.max((d.revenueMinor / max) * 100, 6) : 2;
                return (
                  <div
                    key={d.day}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                    title={`${d.day}: ${(d.revenueMinor / 100).toLocaleString()} · ${d.orders} orders`}
                  >
                    <div
                      className={cn(
                        "w-full transition-all",
                        d.revenueMinor > 0 ? "bg-indigo/70 hover:bg-indigo" : "bg-ink/[0.08]",
                      )}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1.5">
              {trend.map((d) => (
                <span key={d.day} className="flex-1 text-center text-[8px] text-ink/40">
                  {d.day.slice(8)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-[12px] text-ink/45">
            You don’t have access to revenue figures.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <KpiTile
          label="Orders placed"
          value={String(stats.ordersPlaced)}
          hint="in the selected range"
          icon={ShoppingBag}
        />
        <KpiTile
          label="In production"
          value={String(stats.inProduction)}
          hint="currently in the workshop"
          icon={Package}
        />
        <KpiTile
          label="Dispatched"
          value={String(stats.dispatchedInRange)}
          hint="out for delivery"
          icon={Truck}
        />
      </div>
    </div>
  );
}
