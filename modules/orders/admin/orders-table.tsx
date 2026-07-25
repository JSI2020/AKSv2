"use client";

import Link from "next/link";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";

import { Money } from "@/modules/ui";

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
import type { OrderListItem, OrderListResult } from "../queries";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

type OrdersTableProps = {
  result: OrderListResult;
};

export function OrdersTable({ result }: OrdersTableProps) {
  const [params, setParams] = useQueryStates(orderListParsers, {
    history: "push",
    shallow: false,
  });
  const [savedViews, setSavedViews] = useState<SavedOrderView[]>(() =>
    typeof window === "undefined" ? PRESET_VIEWS : loadSavedViews(),
  );
  const [viewName, setViewName] = useState("");

  const allViews = useMemo(() => {
    const custom = savedViews.filter(
      (v) => !PRESET_VIEWS.some((p) => p.id === v.id),
    );
    return [...PRESET_VIEWS, ...custom];
  }, [savedViews]);

  function applyView(view: SavedOrderView) {
    void setParams({
      q: null,
      production: [],
      payment: [],
      source: [],
      sizeMode: [],
      atRisk: null,
      dateFrom: null,
      dateTo: null,
      page: 1,
      view: view.id,
      ...(view.params as Partial<typeof params>),
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
        dateFrom: params.dateFrom?.toISOString() ?? null,
        dateTo: params.dateTo?.toISOString() ?? null,
      }),
    ];
    setSavedViews(next);
    persistSavedViews(next);
    setViewName("");
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border border-indigo-lift p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <span className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
              Search
            </span>
            <input
              type="search"
              value={params.q ?? ""}
              onChange={(e) =>
                void setParams({ q: e.target.value || null, page: 1 })
              }
              placeholder="Order number, name, phone…"
              className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
              At risk
            </span>
            <select
              value={
                params.atRisk === null || params.atRisk === undefined
                  ? ""
                  : params.atRisk
                    ? "yes"
                    : "no"
              }
              onChange={(e) => {
                const v = e.target.value;
                void setParams({
                  atRisk: v === "" ? null : v === "yes",
                  page: 1,
                });
              }}
              className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            >
              <option value="">Any</option>
              <option value="yes">At risk only</option>
              <option value="no">Not at risk</option>
            </select>
          </label>
        </div>

        <FilterChips
          label="Production"
          values={PRODUCTION_STATUS_FILTER_VALUES}
          active={params.production}
          labels={PRODUCTION_STATUS_LABELS}
          onToggle={(value) =>
            void setParams({
              production: toggleValue(params.production, value),
              page: 1,
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
            })
          }
        />
        <FilterChips
          label="Size mode"
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
            })
          }
        />

        <div className="flex flex-wrap items-end gap-2 border-t border-indigo-lift pt-3">
          <span className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
            Saved views
          </span>
          {allViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => applyView(view)}
              className={`border px-2 py-1 text-[12px] ${
                params.view === view.id
                  ? "border-zari text-zari"
                  : "border-indigo-lift text-chalk hover:text-greige"
              }`}
            >
              {view.name}
            </button>
          ))}
          <input
            type="text"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="Save current filters as…"
            className="min-w-[10rem] border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
          />
          <button
            type="button"
            onClick={saveCurrentView}
            className="border border-zari px-2 py-1 text-[12px] text-zari"
          >
            Save view
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-indigo-lift">
        <table className="w-full min-w-[960px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-indigo-lift bg-indigo-lift/30">
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Date</Th>
              <Th>Production</Th>
              <Th>Payment</Th>
              <Th align="end">Total</Th>
              <Th>Promised</Th>
              <Th>At risk</Th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-chalk"
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-chalk">
        <p>
          {result.total} order{result.total === 1 ? "" : "s"} · page{" "}
          {result.page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={result.page <= 1}
            onClick={() => void setParams({ page: result.page - 1 })}
            className="border border-indigo-lift px-2 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={result.page >= totalPages}
            onClick={() => void setParams({ page: result.page + 1 })}
            className="border border-indigo-lift px-2 py-1 disabled:opacity-40"
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
}: {
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  return (
    <th
      className={`px-3 py-2 font-sans text-[11px] font-normal uppercase tracking-[0.08em] text-chalk ${
        align === "end" ? "text-end" : "text-start"
      }`}
    >
      {children}
    </th>
  );
}

function OrderRow({ row }: { row: OrderListItem }) {
  return (
    <tr className="border-b border-indigo-lift/60 hover:bg-indigo-lift/20">
      <td className="px-3 py-2">
        <Link
          href={`/admin/orders/${row.id}`}
          className="font-data text-greige hover:text-zari"
        >
          {row.orderNumber}
        </Link>
      </td>
      <td className="px-3 py-2 text-greige">{row.customerName}</td>
      <td className="px-3 py-2 font-data text-[12px] text-chalk">
        {formatDate(row.placedAt)}
      </td>
      <td className="px-3 py-2">
        <StatusBadge label={PRODUCTION_STATUS_LABELS[row.productionStatus]} />
      </td>
      <td className="px-3 py-2">
        <StatusBadge label={PAYMENT_STATUS_LABELS[row.paymentStatus]} tone="payment" />
      </td>
      <td className="px-3 py-2 text-end">
        <Money value={row.totalMinor} className="text-[12px] text-greige" />
      </td>
      <td className="px-3 py-2 font-data text-[12px] text-chalk">
        {formatDate(row.promisedShipDate)}
      </td>
      <td className="px-3 py-2">
        {row.atRisk ? (
          <span className="font-sans text-[11px] uppercase tracking-[0.08em] text-madder">
            At risk
          </span>
        ) : (
          <span className="text-chalk/50">—</span>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({
  label,
  tone = "production",
}: {
  label: string;
  tone?: "production" | "payment";
}) {
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-sans text-[11px] uppercase tracking-[0.06em] ${
        tone === "payment"
          ? "border-chalk/40 text-chalk"
          : "border-zari/50 text-zari"
      }`}
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[5.5rem] font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
        {label}
      </span>
      {values.map((value) => {
        const isActive = active.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={`border px-2 py-0.5 text-[12px] ${
              isActive
                ? "border-zari text-zari"
                : "border-indigo-lift text-chalk hover:text-greige"
            }`}
          >
            {labels[value] ?? value}
          </button>
        );
      })}
    </div>
  );
}
