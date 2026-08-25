"use client";

import Link from "next/link";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";

import { Money } from "@/modules/ui";
import { cn } from "@/lib/utils";
import { AdminTimeFilter } from "@/modules/admin/time-filter";

import {
  orderListParsers,
  ORDER_SOURCE_VALUES,
  ORDER_SIZE_MODE_VALUES,
} from "./search-params";
import {
  createSavedView,
  loadSavedViews,
  persistSavedViews,
  PRESET_VIEWS,
  type SavedOrderView,
} from "./saved-views";
import {
  PAYMENT_STATUS_LABELS,
  PRODUCTION_STATUS_LABELS,
  PAYMENT_STATUS_FILTER_VALUES,
  PRODUCTION_STATUS_FILTER_VALUES,
} from "../status";
import type { OrderListItem, OrderListResult, OrdersListOverview } from "../queries";

function formatDueDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(value);
}

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

type OrdersTableProps = {
  result: OrderListResult;
  overview: OrdersListOverview;
};

export function OrdersTable({ result, overview }: OrdersTableProps) {
  const [params, setParams] = useQueryStates(orderListParsers, {
    history: "push",
    shallow: false,
  });
  const [savedViews, setSavedViews] = useState<SavedOrderView[]>(() =>
    typeof window === "undefined" ? PRESET_VIEWS : loadSavedViews(),
  );
  const [viewName, setViewName] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const customViews = useMemo(() => {
    return savedViews.filter((v) => !PRESET_VIEWS.some((p) => p.id === v.id));
  }, [savedViews]);

  const activeFilterCount =
    params.production.length +
    params.payment.length +
    params.source.length +
    params.sizeMode.length +
    (params.atRisk !== null && params.atRisk !== undefined ? 1 : 0) +
    (params.due ? 1 : 0) +
    (params.completedThisMonth ? 1 : 0);

  function applyView(view: SavedOrderView) {
    void setParams({
      q: null,
      production: [],
      payment: [],
      source: [],
      sizeMode: [],
      atRisk: null,
      due: null,
      completedThisMonth: null,
      dateFrom: null,
      dateTo: null,
      page: 1,
      view: view.id,
      ...(view.params as Partial<typeof params>),
    });
  }

  function clearAll() {
    void setParams({
      q: null,
      production: [],
      payment: [],
      source: [],
      sizeMode: [],
      atRisk: null,
      due: null,
      completedThisMonth: null,
      dateFrom: null,
      dateTo: null,
      page: 1,
      view: null,
    });
  }

  function saveCurrentView() {
    if (!viewName.trim()) return;
    const next = [
      ...savedViews.filter((v) => !PRESET_VIEWS.some((p) => p.id === v.id)),
      createSavedView(viewName, {
        q: params.q,
        production: params.production,
        payment: params.payment,
        source: params.source,
        sizeMode: params.sizeMode,
        atRisk: params.atRisk,
        due: params.due,
        completedThisMonth: params.completedThisMonth,
        dateFrom: params.dateFrom?.toISOString() ?? null,
        dateTo: params.dateTo?.toISOString() ?? null,
      }),
    ];
    setSavedViews(next);
    persistSavedViews(next);
    setViewName("");
  }

  const chipCounts: Record<string, number> = {
    "preset-all-open": overview.open,
    "preset-new": overview.newCount,
    "preset-in-progress": overview.inProgress,
    "preset-overdue": overview.overdue,
    "preset-completed": overview.completedThisMonth,
    "preset-balance-due": overview.balanceDue,
  };

  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));

  return (
    <div className="flex flex-col gap-4">
      <AdminTimeFilter />
      <div className="flex gap-3">
        <input
          type="search"
          value={params.q ?? ""}
          onChange={(e) =>
            void setParams({ q: e.target.value || null, page: 1 })
          }
          placeholder="Search order number, customer, phone…"
          className="flex-1 border border-ink/12 bg-milk px-4 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESET_VIEWS.map((view) => {
          const isOn =
            params.view === view.id ||
            (view.id === "preset-all-open" &&
              !params.view &&
              !params.due &&
              !params.completedThisMonth &&
              params.payment.length === 0);
          const isOverdue = view.id === "preset-overdue";
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => applyView(view)}
              className={cn(
                "flex items-center gap-2 border border-ink/12 bg-milk px-4 py-2 text-[12.5px] transition-colors",
                isOn && !isOverdue && "border-ink bg-ink text-milk",
                isOn && isOverdue && "border-madder bg-madder text-milk",
                !isOn && "text-ink/70 hover:border-ink",
              )}
            >
              {view.name}
              <span className="font-data text-[10px] opacity-70">
                {chipCounts[view.id] ?? 0}
              </span>
            </button>
          );
        })}
        {customViews.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => applyView(view)}
            className={cn(
              "flex items-center gap-2 border border-ink/12 bg-milk px-4 py-2 text-[12.5px]",
              params.view === view.id
                ? "border-ink bg-ink text-milk"
                : "text-ink/70 hover:border-ink",
            )}
          >
            {view.name}
          </button>
        ))}
        <div className="mx-1 hidden h-5 w-px bg-ink/12 sm:block" aria-hidden />
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={cn(
            "flex items-center gap-2 border border-dashed border-ink/20 px-4 py-2 text-[12px] text-ink/55 hover:border-ink/40 hover:text-ink",
            filtersOpen && "border-solid border-ink/40 text-ink",
          )}
        >
          ⁘ More filters
          {activeFilterCount > 0 ? (
            <span className="font-data text-[10px]">{activeFilterCount}</span>
          ) : null}
        </button>
        {!params.view && activeFilterCount === 0 ? null : (
          <button
            type="button"
            onClick={clearAll}
            className="px-2 text-[12px] text-ink/45 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {filtersOpen ? (
        <div className="border border-ink/12 bg-milk px-5 py-4">
          <FilterChips
            label="Production"
            values={PRODUCTION_STATUS_FILTER_VALUES}
            active={params.production}
            labels={PRODUCTION_STATUS_LABELS}
            onToggle={(value) =>
              void setParams({
                production: toggleValue(params.production, value),
                page: 1,
                view: null,
              })
            }
          />
          <FilterChips
            label="Payment"
            values={PAYMENT_STATUS_FILTER_VALUES}
            active={params.payment}
            labels={PAYMENT_STATUS_LABELS}
            onToggle={(value) =>
              void setParams({
                payment: toggleValue(params.payment, value),
                page: 1,
                view: null,
              })
            }
          />
          <FilterChips
            label="Source"
            values={ORDER_SOURCE_VALUES}
            active={params.source}
            labels={Object.fromEntries(
              ORDER_SOURCE_VALUES.map((s) => [s, s.replaceAll("_", " ")]),
            )}
            onToggle={(value) =>
              void setParams({
                source: toggleValue(params.source, value),
                page: 1,
                view: null,
              })
            }
          />
          <FilterChips
            label="Size"
            values={ORDER_SIZE_MODE_VALUES}
            active={params.sizeMode}
            labels={{
              STANDARD: "Standard",
              MADE_TO_MEASURE: "Made to measure",
            }}
            onToggle={(value) =>
              void setParams({
                sizeMode: toggleValue(params.sizeMode, value),
                page: 1,
                view: null,
              })
            }
          />
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
            <input
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="Save current filters as…"
              className="min-w-[10rem] border border-ink/12 bg-greige px-2 py-1.5 text-[13px] text-ink"
            />
            <button
              type="button"
              onClick={saveCurrentView}
              className="border border-ink px-3 py-1.5 text-[12px] text-ink"
            >
              Save view
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-ink/12 bg-milk">
        <table className="w-full min-w-[960px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-ink/12 bg-greige">
              <Th className="w-8" />
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Item · Size</Th>
              <Th>Production</Th>
              <Th>Payment</Th>
              <Th>Due date</Th>
              <Th align="end">Total</Th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-ink/55"
                >
                  No orders match these filters.
                </td>
              </tr>
            ) : (
              result.items.map((row) => (
                <OrderRow key={row.id} row={row} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink/55">
        <p>
          {overview.open} open · {overview.completedThisMonth} completed this
          month
        </p>
        <div className="flex items-center gap-3">
          <span>
            Page {result.page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={result.page <= 1}
            onClick={() => void setParams({ page: result.page - 1 })}
            className="border border-ink/12 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={result.page >= totalPages}
            onClick={() => void setParams({ page: result.page + 1 })}
            className="border border-ink/12 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "start",
  className,
}: {
  children?: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 font-sans text-[9.5px] font-normal uppercase tracking-[0.14em] text-ink/55",
        align === "end" ? "text-end" : "text-start",
        className,
      )}
    >
      {children}
    </th>
  );
}

function OrderRow({ row }: { row: OrderListItem }) {
  const muted = row.dueTone === "done";
  return (
    <tr
      className={cn(
        "border-b border-ink/10 transition-colors hover:bg-greige/80",
        muted && "opacity-60",
      )}
    >
      <td className="px-4 py-3.5">
        <span
          className={cn(
            "inline-block size-2 rounded-full",
            row.dueTone === "overdue" && "bg-madder",
            row.dueTone === "soon" && "bg-zari",
            (row.dueTone === "ok" || row.dueTone === "done") && "bg-chalk",
          )}
          aria-label={row.dueTone}
        />
      </td>
      <td className="px-4 py-3.5">
        <Link
          href={`/admin/orders/${row.id}`}
          className="font-data text-[12px] text-ink hover:text-madder"
        >
          {row.orderNumber}
        </Link>
      </td>
      <td className="px-4 py-3.5 text-ink">
        {row.customerUserId ? (
          <Link
            href={`/admin/customers/${row.customerUserId}`}
            className="text-ink hover:text-zari"
          >
            {row.customerName}
          </Link>
        ) : row.customerWhatsapp ? (
          <Link
            href={`/admin/customers/guest/${encodeURIComponent(row.customerWhatsapp)}`}
            className="text-ink hover:text-zari"
          >
            {row.customerName}
          </Link>
        ) : (
          row.customerName
        )}
      </td>
      <td className="px-4 py-3.5 text-ink">
        {row.itemSummary}
        {row.sizeLabel ? (
          <>
            {" · "}
            <span className="inline-block border border-ink/12 px-1.5 py-0.5 font-data text-[11px]">
              {row.sizeLabel}
            </span>
          </>
        ) : null}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge
          label={PRODUCTION_STATUS_LABELS[row.productionStatus]}
          done={row.dueTone === "done"}
        />
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge
          label={PAYMENT_STATUS_LABELS[row.paymentStatus]}
          tone="payment"
        />
      </td>
      <td
        className={cn(
          "px-4 py-3.5 font-data text-[12px]",
          row.dueTone === "overdue" && "text-madder",
          row.dueTone === "soon" && "text-zari",
          row.dueTone === "ok" && "text-ink",
          row.dueTone === "done" && "text-ink/55",
        )}
      >
        {formatDueDate(row.promisedShipDate)}
        <span
          className={cn(
            "mt-0.5 block text-[10px] tracking-[0.04em]",
            row.dueTone === "overdue" && "text-madder",
            row.dueTone === "soon" && "text-zari",
            row.dueTone === "ok" && "text-chalk",
            row.dueTone === "done" && "text-ink/45",
          )}
        >
          {row.relativeDue}
        </span>
      </td>
      <td className="px-4 py-3.5 text-end">
        <Money
          value={row.totalMinor}
          className="font-data text-[12px] text-ink"
        />
      </td>
    </tr>
  );
}

function StatusBadge({
  label,
  tone = "production",
  done = false,
}: {
  label: string;
  tone?: "production" | "payment";
  done?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-block border px-2.5 py-1 font-sans text-[10px] uppercase tracking-[0.06em]",
        tone === "payment" && "border-zari text-zari",
        tone === "production" && !done && "border-chalk text-chalk",
        tone === "production" && done && "border-chalk bg-chalk text-milk",
      )}
    >
      {label}
    </span>
  );
}

function FilterChips<T extends string>({
  label,
  values,
  active,
  labels,
  onToggle,
}: {
  label: string;
  values: readonly T[];
  active: T[];
  labels: Record<string, string>;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 py-2">
      <span className="min-w-[90px] font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
        {label}
      </span>
      {values.map((value) => {
        const isActive = active.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={cn(
              "border border-ink/12 px-2.5 py-1 text-[11.5px] text-ink/55 transition-colors hover:border-ink hover:text-ink",
              isActive && "border-ink text-ink",
            )}
          >
            {labels[value] ?? value}
          </button>
        );
      })}
    </div>
  );
}
