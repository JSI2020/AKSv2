"use client";

import { useQueryStates } from "nuqs";

import { cn } from "@/lib/utils";

import { orderListParsers } from "./search-params";
import type { OrdersListOverview } from "../queries";
import {
  IN_PROGRESS_PRODUCTION_STATUSES,
  OPEN_PRODUCTION_STATUSES,
} from "../status";

type OrdersOverviewProps = {
  overview: OrdersListOverview;
};

export function OrdersOverview({ overview }: OrdersOverviewProps) {
  const [, setParams] = useQueryStates(orderListParsers, {
    history: "push",
    shallow: false,
  });

  const maxFunnel = Math.max(1, ...overview.funnel.map((f) => f.count));

  function filterInProgress() {
    void setParams({
      production: [...IN_PROGRESS_PRODUCTION_STATUSES],
      payment: [],
      due: null,
      completedThisMonth: null,
      atRisk: null,
      page: 1,
      view: "preset-in-progress",
    });
  }

  function filterDueSoon() {
    void setParams({
      production: [...OPEN_PRODUCTION_STATUSES],
      payment: [],
      due: "soon",
      completedThisMonth: null,
      atRisk: null,
      page: 1,
      view: null,
    });
  }

  function filterOverdue() {
    void setParams({
      production: [],
      payment: [],
      due: "overdue",
      completedThisMonth: null,
      atRisk: null,
      page: 1,
      view: "preset-overdue",
    });
  }

  function filterCompleted() {
    void setParams({
      production: ["COMPLETED"],
      payment: [],
      due: null,
      completedThisMonth: true,
      atRisk: null,
      page: 1,
      view: "preset-completed",
    });
  }

  const stats = [
    {
      key: "inProgress",
      label: "In progress",
      n: overview.inProgress,
      tone: "ok" as const,
      bar: Math.min(100, (overview.inProgress / Math.max(1, overview.open)) * 100),
      onClick: filterInProgress,
    },
    {
      key: "dueSoon",
      label: "Due soon",
      n: overview.dueSoon,
      tone: "warn" as const,
      bar: Math.min(100, (overview.dueSoon / Math.max(1, overview.open)) * 100),
      onClick: filterDueSoon,
    },
    {
      key: "overdue",
      label: "Overdue",
      n: overview.overdue,
      tone: "alert" as const,
      bar: Math.min(100, (overview.overdue / Math.max(1, overview.open)) * 100),
      onClick: filterOverdue,
    },
    {
      key: "completed",
      label: "Completed",
      sub: "· this month",
      n: overview.completedThisMonth,
      tone: "ok" as const,
      bar: 100,
      onClick: filterCompleted,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-ink/12 bg-ink/12 sm:grid-cols-4">
        {stats.map((stat) => (
          <button
            key={stat.key}
            type="button"
            onClick={stat.onClick}
            className="bg-milk px-4 py-4 text-start transition-colors hover:bg-greige"
          >
            <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-ink/55">
              {stat.label}
              {stat.sub ? (
                <span className="opacity-50"> {stat.sub}</span>
              ) : null}
            </p>
            <p
              className={cn(
                "mt-2 font-display text-[2.2rem] font-light leading-none text-ink",
                stat.tone === "alert" && "text-madder",
                stat.tone === "warn" && "text-zari",
              )}
            >
              {stat.n}
            </p>
            <div className="mt-2.5 h-[3px] overflow-hidden bg-ink/10">
              <span
                className={cn(
                  "block h-full",
                  stat.tone === "alert" && "bg-madder",
                  stat.tone === "warn" && "bg-zari",
                  stat.tone === "ok" && "bg-chalk",
                )}
                style={{ width: `${stat.bar}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      <div className="border border-ink/12 bg-milk px-5 py-4">
        <h3 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Where orders are right now
        </h3>
        <ul className="mt-4 flex flex-col gap-2.5">
          {overview.funnel.map((row) => (
            <li key={row.stage} className="flex items-center gap-3 text-[12px]">
              <span className="w-[4.8rem] capitalize text-ink/55">
                {row.label}
              </span>
              <span className="h-4 flex-1 overflow-hidden bg-greige">
                <span
                  className="block h-full bg-indigo transition-[width] duration-500"
                  style={{
                    width: `${(row.count / maxFunnel) * 100}%`,
                  }}
                />
              </span>
              <span className="w-5 text-end font-data text-[11px] text-ink">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
