"use client";

import { useTransition } from "react";

import { Money } from "@/modules/ui";

import { upsertRecurringCost } from "./actions";
import {
  formatMarginPercent,
  marginColorClass,
} from "./compute";
import type { MoneyDashboardData } from "./queries";

export function MoneyDashboard({ data }: { data: MoneyDashboardData }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard
          label="Revenue today"
          value={<Money value={data.revenue.today.revenueMinor} />}
          sub={`${data.revenue.today.orderCount} orders`}
        />
        <StatCard
          label="Revenue this week"
          value={<Money value={data.revenue.week.revenueMinor} />}
          sub={`${data.revenue.week.orderCount} orders`}
        />
        <StatCard
          label="Revenue this month"
          value={<Money value={data.revenue.month.revenueMinor} />}
          sub={`${data.revenue.month.orderCount} orders`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border border-indigo-lift p-4">
          <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Deposits & balances
          </h2>
          <ul className="mt-3 space-y-2 text-[13px] text-greige">
            <li className="flex justify-between gap-4">
              <span>Deposits received (month)</span>
              <Money value={data.depositsReceivedMinor} />
            </li>
            <li className="flex justify-between gap-4">
              <span>Balances outstanding</span>
              <Money value={data.balancesOutstandingMinor} />
            </li>
          </ul>
        </div>

        <div className="border border-indigo-lift p-4">
          <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-madder">
            Outstanding COD
          </h2>
          <p className="mt-2 text-[13px] text-greige">
            Delivered but not yet remitted by courier —{" "}
            <Money value={data.outstandingCodTotalMinor} className="text-madder" />
          </p>
          {data.outstandingCod.length === 0 ? (
            <p className="mt-2 text-[12px] text-chalk">No outstanding COD.</p>
          ) : (
            <ul className="mt-3 divide-y divide-indigo-lift border border-indigo-lift">
              {data.outstandingCod.slice(0, 8).map((row) => (
                <li
                  key={row.orderId}
                  className="flex justify-between gap-2 px-3 py-2 text-[12px] text-greige"
                >
                  <span>{row.orderNumber}</span>
                  <Money value={row.balanceMinor} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="border border-indigo-lift p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Recurring costs
          </h2>
          <p className="font-data text-[12px] text-zari">
            Monthly total: <Money value={data.monthlyFixedMinor} />
          </p>
        </div>
        {data.recurringCosts.length === 0 ? (
          <p className="mt-3 text-[13px] text-chalk">
            No recurring costs yet — add hosting, domain, tools below.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-indigo-lift border border-indigo-lift">
            {data.recurringCosts.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px] text-greige"
              >
                <span>
                  {row.name}{" "}
                  <span className="font-data text-[11px] text-chalk">
                    {row.category} · {row.cycle}
                  </span>
                </span>
                <span className="font-data text-[12px] text-chalk">
                  <Money value={row.amountMinor} /> →{" "}
                  <Money value={row.monthlyMinor} className="text-zari" />
                  /mo
                </span>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 grid gap-3 border border-indigo-lift p-3 lg:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              await upsertRecurringCost(fd);
              e.currentTarget.reset();
            });
          }}
        >
          <p className="lg:col-span-2 font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Add recurring cost
          </p>
          <input
            name="name"
            required
            placeholder="Name"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
          <input
            name="category"
            required
            placeholder="Category"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
          <input
            name="amountMinor"
            type="number"
            min={0}
            required
            placeholder="Amount (paisa)"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige"
          />
          <select
            name="cycle"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
          <input
            name="startedAt"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
          <button
            type="submit"
            disabled={pending}
            className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
          >
            {pending ? "Saving…" : "Add cost"}
          </button>
        </form>
      </section>

      {data.showMargin ? (
        <>
          <section className="border border-indigo-lift p-4">
            <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Break-even
            </h2>
            <p className="mt-2 text-[15px] text-greige">{data.breakEven.message}</p>
            <p className="mt-1 font-data text-[12px] text-chalk">
              Fixed costs/mo <Money value={data.breakEven.monthlyFixedMinor} /> ·
              Contribution this month{" "}
              <Money value={data.breakEven.monthContributionMinor} /> · Avg/order{" "}
              <Money value={data.breakEven.avgContributionPerOrderMinor} />
            </p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <MarginRankTable
              title="Designs — most profitable"
              rows={data.designMargins.slice(0, 5)}
            />
            <MarginRankTable
              title="Designs — least profitable"
              rows={[...data.designMargins].reverse().slice(0, 5)}
            />
            <MarginRankTable
              title="Orders — most profitable (month)"
              rows={data.orderMargins.slice(0, 5)}
              showRevenue
            />
            <MarginRankTable
              title="Orders — least profitable (month)"
              rows={[...data.orderMargins].reverse().slice(0, 5)}
              showRevenue
            />
          </section>
        </>
      ) : (
        <p className="text-[13px] text-chalk">
          Margin details require the money.view_margin permission.
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="border border-indigo-lift p-4">
      <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
        {label}
      </p>
      <p className="mt-2 font-data text-xl text-greige">{value}</p>
      <p className="mt-1 text-[12px] text-chalk">{sub}</p>
    </div>
  );
}

function MarginRankTable({
  title,
  rows,
  showRevenue = false,
}: {
  title: string;
  rows: MoneyDashboardData["designMargins"];
  showRevenue?: boolean;
}) {
  return (
    <div className="border border-indigo-lift p-4">
      <h3 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-chalk">No data yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-indigo-lift">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12px] text-greige"
            >
              <span>{row.label}</span>
              <span className="font-data tabular-nums">
                {showRevenue ? (
                  <>
                    <Money value={row.marginMinor} /> /{" "}
                    <Money value={row.revenueMinor} />
                  </>
                ) : (
                  <span className={marginColorClass(row.marginPercent)}>
                    {formatMarginPercent(row.marginPercent)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
