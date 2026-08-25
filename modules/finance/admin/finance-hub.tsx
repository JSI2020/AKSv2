"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useQueryStates } from "nuqs";

import { Money } from "@/modules/ui";
import { AdminTimeFilter } from "@/modules/admin/time-filter";
import { VerificationQueue } from "@/modules/payments/admin/verification-queue";
import type { VerificationQueueItem } from "@/modules/payments/bank-transfer/queries";
import { recordCodRemittanceAction } from "@/modules/payments/cod/actions";
import { PAYMENT_STATUS_LABELS } from "@/modules/orders/status";

import { saveExpenditureAction } from "../actions";
import {
  EXPENDITURE_CATEGORY_LABELS,
  type ExpenditureCategory,
  type ExpenditureRow,
} from "../expenditures-math";
import { financeSearchParams, type FinanceTab } from "../search-params";

type HubData = {
  overview: Awaited<
    ReturnType<typeof import("../queries").getFinanceOverview>
  >;
  ordersPayment: Awaited<
    ReturnType<typeof import("../queries").listFinanceOrdersPayment>
  >;
  expenditure: Awaited<
    ReturnType<typeof import("../queries").getExpenditureTabData>
  >;
  remittances: Array<{
    id: string;
    courier: string;
    remittanceRef: string;
    expectedAmountMinor: number;
    receivedAmountMinor: number;
    receivedAt: Date;
    orderIds: string[];
    perOrderExpected: Record<string, number>;
    discrepancyNote: string | null;
    hasDiscrepancy: boolean;
    shortfallMinor: number;
  }>;
  verification: VerificationQueueItem[];
  margin: Awaited<ReturnType<typeof import("../queries").getFinanceMargin>>;
  remittableOrders: Array<{
    orderId: string;
    orderNumber: string;
    balanceMinor: number;
    customerName: string;
  }>;
};

const TABS: { id: FinanceTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders payment" },
  { id: "expenditure", label: "Expenditure" },
  { id: "cod", label: "COD remittances" },
  { id: "verify", label: "Verify transfers" },
  { id: "margin", label: "Money & margin" },
];

function formatDay(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function FinanceHub({ data }: { data: HubData }) {
  const [params, setParams] = useQueryStates(financeSearchParams, {
    history: "push",
    shallow: false,
  });
  const tab = params.tab ?? "overview";

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={[
              "border px-4 py-2 text-[11.5px] tracking-wide",
              tab === t.id
                ? "border-ink bg-ink text-milk"
                : "border-ink/12 text-ink/55 hover:border-ink hover:text-ink",
            ].join(" ")}
            onClick={() => void setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "verify" ? (
        <div className="mb-5">
          <AdminTimeFilter />
        </div>
      ) : null}

      {tab === "overview" ? <OverviewPanel data={data.overview} /> : null}
      {tab === "orders" ? (
        <OrdersPaymentPanel data={data.ordersPayment} />
      ) : null}
      {tab === "expenditure" ? (
        <ExpenditurePanel data={data.expenditure} />
      ) : null}
      {tab === "cod" ? (
        <CodPanel
          remittances={data.remittances}
          remittable={data.remittableOrders}
        />
      ) : null}
      {tab === "verify" ? (
        <div className="border border-ink/12 bg-milk p-5">
          <p className="mb-4 text-[13px] text-ink/55">
            Deposits and full payments made by bank transfer — receipt beside
            the expected amount. Live queue, not a period to browse.
          </p>
          <VerificationQueue items={data.verification} />
        </div>
      ) : null}
      {tab === "margin" ? <MarginPanel data={data.margin} /> : null}
    </div>
  );
}

function OverviewPanel({ data }: { data: HubData["overview"] }) {
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.revenueMinor));
  const statusMax = Math.max(1, ...Object.values(data.payStatusCounts));

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden border border-ink/12 bg-ink/12 xl:grid-cols-4">
        <Stat
          label="Revenue"
          value={<Money value={data.revenueMinor} />}
        />
        <Stat
          label="Outstanding"
          value={<Money value={data.outstandingMinor} />}
          sub="deposits + balances not yet in"
        />
        <Stat
          label="COD cash in transit"
          value={<Money value={data.codInTransitMinor} />}
          sub="collected by courier, not yet remitted"
          risk
        />
        <Stat
          label="COD refusal rate"
          value={`${data.refusalRatePercent}%`}
          sub="in this period"
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div className="border border-ink/12 bg-milk p-5">
          <h3 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
            How revenue is actually paid
          </h3>
          <div className="flex flex-wrap items-center gap-6">
            <Donut
              segments={[
                { pct: data.paymentMix.codBasedPercent, color: "#B08D4C" },
                { pct: data.paymentMix.fullPrepayPercent, color: "#7C8770" },
                { pct: data.paymentMix.bankFullPercent, color: "#8C2F39" },
              ]}
              center={`${data.paymentMix.codBasedPercent}%`}
              centerLabel="COD-based"
            />
            <div className="min-w-[180px] flex-1 text-[12.5px]">
              <Leg
                color="#B08D4C"
                label="Deposit + COD balance"
                pct={data.paymentMix.codBasedPercent}
              />
              <Leg
                color="#7C8770"
                label="Full prepay online"
                pct={data.paymentMix.fullPrepayPercent}
              />
              <Leg
                color="#8C2F39"
                label="Bank transfer, in full"
                pct={data.paymentMix.bankFullPercent}
              />
            </div>
          </div>
        </div>
        <div className="border border-ink/12 bg-milk p-5">
          <h3 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
            Revenue trend · PKR &apos;000
          </h3>
          <div className="flex h-[110px] items-end gap-2 pt-4">
            {data.trend.map((t) => (
              <div
                key={t.label}
                className="relative min-h-[4px] flex-1 rounded-t-[2px] bg-zari"
                style={{
                  height: `${Math.max(4, (t.revenueMinor / maxTrend) * 100)}%`,
                }}
              >
                <span className="absolute -top-4 start-1/2 -translate-x-1/2 font-data text-[8.5px] text-ink/55">
                  {Math.round(t.revenueMinor / 100_000)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2">
            {data.trend.map((t) => (
              <span
                key={t.label}
                className="flex-1 text-center text-[9px] text-ink/55"
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-5 border border-ink/12 bg-milk p-5">
        <h3 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Where COD cash is right now
        </h3>
        <div className="flex flex-col gap-px overflow-hidden border border-ink/12 bg-ink/12 md:flex-row">
          <FunnelStage
            tone="risk"
            label="Out for delivery"
            count={data.codFunnel.outForDelivery.count}
            minor={data.codFunnel.outForDelivery.minor}
            note="not yet collected"
          />
          <FunnelStage
            tone="mid"
            label="Collected, not remitted"
            count={data.codFunnel.collectedNotRemitted.count}
            minor={data.codFunnel.collectedNotRemitted.minor}
            note="in courier's hands"
          />
          <FunnelStage
            tone="ok"
            label="Remitted & reconciled"
            count={data.codFunnel.remitted.count}
            minor={data.codFunnel.remitted.minor}
            note="confirmed in bank"
          />
        </div>
      </div>

      <div className="border border-ink/12 bg-milk p-5">
        <h3 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Orders by payment status
        </h3>
        {(
          [
            ["AWAITING_DEPOSIT", "Awaiting deposit", "#565E72"],
            ["BALANCE_DUE", "Balance due (COD)", "#C08A3E"],
            ["PAID", "Paid in full", "#7C8770"],
            ["REFUNDED", "Refunded", "#8C2F39"],
          ] as const
        ).map(([key, lab, color]) => {
          const n = data.payStatusCounts[key] ?? 0;
          return (
            <div
              key={key}
              className="mb-3 flex items-center gap-3 text-[12.5px]"
            >
              <span className="w-[130px] text-ink/55">{lab}</span>
              <div className="h-4 flex-1 overflow-hidden bg-greige">
                <div
                  className="h-full"
                  style={{
                    width: `${(n / statusMax) * 100}%`,
                    background: color,
                  }}
                />
              </div>
              <span className="w-6 text-end font-data text-[11.5px]">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrdersPaymentPanel({
  data,
}: {
  data: HubData["ordersPayment"];
}) {
  const [chip, setChip] = useState("all");
  const filtered = useMemo(() => {
    if (chip === "all") return data.rows;
    if (chip === "await")
      return data.rows.filter((r) => r.paymentStatus === "AWAITING_DEPOSIT");
    if (chip === "due")
      return data.rows.filter(
        (r) =>
          r.paymentStatus === "BALANCE_DUE" ||
          r.paymentStatus === "DEPOSIT_PAID",
      );
    if (chip === "full")
      return data.rows.filter((r) => r.paymentStatus === "PAID");
    if (chip === "refunded")
      return data.rows.filter((r) => r.paymentStatus === "REFUNDED");
    return data.rows;
  }, [chip, data.rows]);

  const chips = [
    { id: "all", label: `All · ${data.rows.length}` },
    {
      id: "await",
      label: `Awaiting deposit · ${data.rows.filter((r) => r.paymentStatus === "AWAITING_DEPOSIT").length}`,
    },
    {
      id: "due",
      label: `Balance due · ${data.rows.filter((r) => r.paymentStatus === "BALANCE_DUE" || r.paymentStatus === "DEPOSIT_PAID").length}`,
    },
    {
      id: "full",
      label: `Paid in full · ${data.rows.filter((r) => r.paymentStatus === "PAID").length}`,
    },
    {
      id: "refunded",
      label: `Refunded · ${data.rows.filter((r) => r.paymentStatus === "REFUNDED").length}`,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={[
              "border px-3 py-2 text-[11.5px]",
              chip === c.id
                ? "border-ink bg-ink text-milk"
                : "border-ink/12 text-ink/55",
            ].join(" ")}
            onClick={() => setChip(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mb-5 grid grid-cols-1 gap-px overflow-hidden border border-ink/12 bg-ink/12 sm:grid-cols-3">
        <Stat
          label="Collected this period"
          value={<Money value={data.collectedMinor} />}
        />
        <Stat
          label="Outstanding this period"
          value={<Money value={data.outstandingMinor} />}
        />
        <Stat label="Orders" value={String(data.orderCount)} />
      </div>
      <div className="overflow-x-auto border border-ink/12 bg-milk">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-ink text-start text-[9.5px] uppercase tracking-[0.1em] text-ink/55">
              <th className="px-3 py-2 font-normal">Order</th>
              <th className="px-3 py-2 font-normal">Customer</th>
              <th className="px-3 py-2 font-normal">Date</th>
              <th className="px-3 py-2 font-normal">Total</th>
              <th className="px-3 py-2 font-normal">Deposit</th>
              <th className="px-3 py-2 font-normal">Balance</th>
              <th className="px-3 py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-ink/10">
                <td className="px-3 py-3 font-data">
                  <Link
                    href={`/admin/orders/${r.id}`}
                    className="text-ink hover:text-zari"
                  >
                    {r.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  {r.userId ? (
                    <Link
                      href={`/admin/customers/${r.userId}`}
                      className="hover:text-zari"
                    >
                      {r.customerName}
                    </Link>
                  ) : (
                    r.customerName
                  )}
                </td>
                <td className="px-3 py-3">{formatDay(r.placedAt)}</td>
                <td className="px-3 py-3 font-data">
                  <Money value={r.totalMinor} />
                </td>
                <td className="px-3 py-3 font-data text-[11px]">
                  {r.depositLabel}
                </td>
                <td className="px-3 py-3 font-data text-[11px]">
                  {r.balanceLabel}
                </td>
                <td className="px-3 py-3">
                  <span className="border border-ink/12 bg-greige px-2 py-0.5 text-[9.5px] uppercase tracking-wide text-ink/55">
                    {PAYMENT_STATUS_LABELS[r.paymentStatus]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpenditurePanel({
  data,
}: {
  data: HubData["expenditure"];
}) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<string>("All");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const maxCat = Math.max(1, ...data.byCategory.map((c) => c.amountMinor));

  const rows =
    cat === "All"
      ? data.ledger
      : data.ledger.filter((r) => r.category === cat);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-[13px] text-ink/55">
          Rent, salaries, marketing, equipment, bills — everything paid out that
          isn&apos;t fabric or a per-order cost.
        </p>
        <button
          type="button"
          className="bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-milk"
          onClick={() => setOpen((o) => !o)}
        >
          + Add expense
        </button>
      </div>

      {open ? (
        <form
          className="mb-5 border border-ink/12 bg-milk p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await saveExpenditureAction({
                date: String(fd.get("date")),
                category: String(fd.get("category")),
                payee: String(fd.get("payee")),
                amountPkr: String(fd.get("amount")),
                paymentMethod: String(fd.get("paymentMethod")),
                isRecurring: fd.get("isRecurring") === "on",
                recurrenceCycle: "MONTHLY",
                note: String(fd.get("note") ?? ""),
              });
              setMsg(res.ok ? "Saved." : res.error);
              if (res.ok) setOpen(false);
            });
          }}
        >
          <h3 className="mb-3 text-[10px] uppercase tracking-[0.16em] text-ink/55">
            New expense
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date">
              <input
                name="date"
                type="date"
                required
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Category">
              <select
                name="category"
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              >
                {(
                  Object.keys(EXPENDITURE_CATEGORY_LABELS) as ExpenditureCategory[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {EXPENDITURE_CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (PKR)">
              <input
                name="amount"
                type="number"
                step="1"
                min="1"
                required
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Payee / vendor">
              <input
                name="payee"
                required
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Payment method">
              <select
                name="paymentMethod"
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CARD">Card</option>
              </select>
            </Field>
            <Field label="Note">
              <input
                name="note"
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="isRecurring" />
            This repeats every month (rent, subscriptions, salaries)
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 bg-ink px-4 py-2 text-[12px] uppercase tracking-wide text-milk disabled:opacity-50"
          >
            Save expense
          </button>
          {msg ? <p className="mt-2 text-[12px] text-ink/55">{msg}</p> : null}
        </form>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {["All", ...Object.keys(EXPENDITURE_CATEGORY_LABELS)].map((c) => (
          <button
            key={c}
            type="button"
            className={[
              "border px-3 py-2 text-[11.5px]",
              cat === c
                ? "border-ink bg-ink text-milk"
                : "border-ink/12 text-ink/55",
            ].join(" ")}
            onClick={() => setCat(c)}
          >
            {c === "All"
              ? "All"
              : EXPENDITURE_CATEGORY_LABELS[c as ExpenditureCategory]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto border border-ink/12 bg-milk">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-ink text-[9.5px] uppercase tracking-[0.1em] text-ink/55">
                <th className="px-3 py-2 text-start font-normal">Date</th>
                <th className="px-3 py-2 text-start font-normal">Category</th>
                <th className="px-3 py-2 text-start font-normal">Payee</th>
                <th className="px-3 py-2 text-start font-normal">Method</th>
                <th className="px-3 py-2 text-end font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: ExpenditureRow) => (
                <tr key={r.id} className="border-b border-ink/10">
                  <td className="px-3 py-3">{formatDay(r.date)}</td>
                  <td className="px-3 py-3">
                    <span className="border border-ink/12 bg-greige px-2 py-0.5 text-[9.5px] uppercase">
                      {EXPENDITURE_CATEGORY_LABELS[r.category]}
                    </span>
                    {r.isRecurring ? (
                      <div className="mt-1 text-[9px] text-[#7C8770]">
                        ↻ recurring
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{r.payee}</td>
                  <td className="px-3 py-3">{r.paymentMethod.replace("_", " ")}</td>
                  <td className="px-3 py-3 text-end font-data">
                    <Money value={r.amountMinor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border border-ink/12 bg-milk p-5">
          <h3 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
            By category, this period
          </h3>
          {data.byCategory.map((c) => (
            <div
              key={c.category}
              className="mb-2 flex items-center gap-2 text-[12px]"
            >
              <span className="w-[90px] text-ink/55">
                {EXPENDITURE_CATEGORY_LABELS[c.category]}
              </span>
              <div className="h-3 flex-1 overflow-hidden bg-greige">
                <div
                  className="h-full bg-zari"
                  style={{
                    width: `${(c.amountMinor / maxCat) * 100}%`,
                  }}
                />
              </div>
              <span className="w-[70px] text-end font-data text-[11px]">
                <Money value={c.amountMinor} />
              </span>
            </div>
          ))}
          <div className="mt-4 flex justify-between border-t border-ink pt-3 text-[13px]">
            <span className="text-ink/55">Total expenditure</span>
            <span className="font-data">
              <Money value={data.totalMinor} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodPanel({
  remittances,
  remittable,
}: {
  remittances: HubData["remittances"];
  remittable: HubData["remittableOrders"];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const expected = remittable
    .filter((o) => selected.includes(o.orderId))
    .reduce((s, o) => s + o.balanceMinor, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-[13px] text-ink/55">
          A courier collects cash at delivery and pays it to you later, in
          batches. Confirm what actually arrived.
        </p>
        <button
          type="button"
          className="bg-ink px-4 py-2 text-[12px] uppercase tracking-wide text-milk"
          onClick={() => setOpen((o) => !o)}
        >
          + Record a remittance
        </button>
      </div>

      {open ? (
        <form
          className="mb-5 border border-ink/12 bg-milk p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const receivedPkr = Number(fd.get("received"));
            const perOrderExpected = Object.fromEntries(
              remittable
                .filter((o) => selected.includes(o.orderId))
                .map((o) => [o.orderId, o.balanceMinor]),
            );
            start(async () => {
              const res = await recordCodRemittanceAction({
                courier: String(fd.get("courier")),
                remittanceRef: String(fd.get("ref")),
                expectedAmountMinor: expected,
                receivedAmountMinor: Math.round(receivedPkr * 100),
                receivedAt: String(fd.get("receivedAt")),
                orderIds: selected,
                perOrderExpected,
                discrepancyNote: String(fd.get("note") ?? "") || undefined,
              });
              setMsg(res.ok ? "Remittance recorded." : res.error);
              if (res.ok) {
                setOpen(false);
                setSelected([]);
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Courier">
              <input
                name="courier"
                required
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Batch ref">
              <input
                name="ref"
                required
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Received date">
              <input
                name="receivedAt"
                type="datetime-local"
                required
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Received (PKR)">
              <input
                name="received"
                type="number"
                required
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Note">
              <input
                name="note"
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px]"
              />
            </Field>
          </div>
          <p className="mt-3 text-[12px] text-ink/55">
            Expected from selection: <Money value={expected} />
          </p>
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-[12px]">
            {remittable.map((o) => (
              <li key={o.orderId}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.orderId)}
                    onChange={(e) => {
                      setSelected((prev) =>
                        e.target.checked
                          ? [...prev, o.orderId]
                          : prev.filter((id) => id !== o.orderId),
                      );
                    }}
                  />
                  <Link
                    href={`/admin/orders/${o.orderId}`}
                    className="font-data hover:text-zari"
                  >
                    {o.orderNumber}
                  </Link>
                  <span>{o.customerName}</span>
                  <Money value={o.balanceMinor} />
                </label>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            disabled={pending || selected.length === 0}
            className="mt-4 bg-ink px-4 py-2 text-[12px] uppercase text-milk disabled:opacity-50"
          >
            Save remittance
          </button>
          {msg ? <p className="mt-2 text-[12px] text-ink/55">{msg}</p> : null}
        </form>
      ) : null}

      <div className="overflow-x-auto border border-ink/12 bg-milk">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-ink text-[9.5px] uppercase tracking-[0.1em] text-ink/55">
              <th className="px-3 py-2 text-start font-normal">Courier</th>
              <th className="px-3 py-2 text-start font-normal">Batch</th>
              <th className="px-3 py-2 text-start font-normal">Date</th>
              <th className="px-3 py-2 text-start font-normal">Orders</th>
              <th className="px-3 py-2 text-start font-normal">Expected</th>
              <th className="px-3 py-2 text-start font-normal">Received</th>
              <th className="px-3 py-2 text-start font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {remittances.map((r) => (
              <tr key={r.id} className="border-b border-ink/10">
                <td className="px-3 py-3">{r.courier}</td>
                <td className="px-3 py-3 font-data">{r.remittanceRef}</td>
                <td className="px-3 py-3">{formatDay(r.receivedAt)}</td>
                <td className="px-3 py-3">{r.orderIds.length}</td>
                <td className="px-3 py-3 font-data">
                  <Money value={r.expectedAmountMinor} />
                </td>
                <td
                  className={[
                    "px-3 py-3 font-data",
                    r.shortfallMinor > 0 ? "text-madder" : "",
                  ].join(" ")}
                >
                  <Money value={r.receivedAmountMinor} />
                </td>
                <td className="px-3 py-3">
                  {r.shortfallMinor > 0 ? (
                    <span className="bg-madder/10 px-2 py-0.5 text-[9.5px] uppercase text-madder">
                      Short <Money value={r.shortfallMinor} />
                    </span>
                  ) : r.receivedAmountMinor === 0 ? (
                    <span className="bg-amber-500/10 px-2 py-0.5 text-[9.5px] uppercase text-[#C08A3E]">
                      Pending
                    </span>
                  ) : (
                    <span className="bg-[#7C8770]/15 px-2 py-0.5 text-[9.5px] uppercase text-[#7C8770]">
                      Matched
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remittances.some((r) => r.shortfallMinor > 0) ? (
        <p className="mt-3 border border-[#C08A3E]/25 bg-[#C08A3E]/10 px-4 py-3 text-[12px] text-[#C08A3E]">
          A short batch needs a look — handling fee, refused delivery, or
          genuine shortfall. Flagged against specific orders via per-order
          expected, not lost.
        </p>
      ) : null}
    </div>
  );
}

function MarginPanel({ data }: { data: HubData["margin"] }) {
  if (!data.showMargin) {
    return (
      <p className="text-[13px] text-ink/55">
        Margin numbers require the money.view_margin permission.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden border border-ink/12 bg-ink/12">
        <div className="bg-milk p-5 text-center">
          <div className="text-[9.5px] uppercase tracking-[0.1em] text-ink/55">
            Gross margin
          </div>
          <div className="mt-2 font-display text-[2.1rem] text-[#7C8770]">
            {data.grossMarginPercent}%
          </div>
        </div>
        <div className="bg-milk p-5 text-center">
          <div className="text-[9.5px] uppercase tracking-[0.1em] text-ink/55">
            Net margin
          </div>
          <div className="mt-2 font-display text-[2.1rem] text-[#C08A3E]">
            {data.netMarginPercent}%
          </div>
        </div>
      </div>
      <p className="mb-5 text-[12px] leading-relaxed text-ink/55">
        Gross margin only removes what it directly cost to make and deliver what
        you sold. Net margin also removes rent, salaries, marketing, and
        everything else from the Expenditure log. The gap is real overhead.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-ink/12 bg-milk p-5">
          <h3 className="mb-3 text-[10px] uppercase tracking-[0.16em] text-ink/55">
            Direct production costs
          </h3>
          <Crow k="Revenue" v={<Money value={data.revenueMinor} />} />
          <Crow
            k="Fabric, stitching, packaging"
            v={<Money value={data.productionCostMinor} />}
          />
          <Crow
            k="Courier + COD handling fees"
            v={<Money value={data.codFeeMinor} />}
          />
          <Crow
            k="Gross profit"
            v={<Money value={data.grossProfitMinor} />}
            total
            tone="sage"
          />
        </div>
        <div className="border border-ink/12 bg-milk p-5">
          <h3 className="mb-3 text-[10px] uppercase tracking-[0.16em] text-ink/55">
            Operating expenditure
          </h3>
          <Crow
            k="Recurring (rent, software, salaries)"
            v={<Money value={data.recurringExpenditureMinor} />}
          />
          <Crow
            k="One-off (marketing, equipment)"
            v={<Money value={data.oneOffExpenditureMinor} />}
          />
          <Crow
            k="Net profit"
            v={<Money value={data.netProfitMinor} />}
            total
            tone="amber"
          />
        </div>
      </div>
      <div className="mt-5 bg-indigo p-5 text-milk">
        <div className="text-[9.5px] uppercase tracking-[0.14em] opacity-60">
          Break-even this period
        </div>
        <div className="mt-2 font-display text-[1.6rem]">
          {data.breakEvenMessage}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  risk,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  risk?: boolean;
}) {
  return (
    <div className="bg-milk px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
        {label}
      </div>
      <div
        className={[
          "mt-2 font-display text-[1.5rem]",
          risk ? "text-madder" : "text-ink",
        ].join(" ")}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-[10.5px] text-ink/55">{sub}</div> : null}
    </div>
  );
}

function Donut({
  segments,
  center,
  centerLabel,
}: {
  segments: { pct: number; color: string }[];
  center: string;
  centerLabel: string;
}) {
  let acc = 0;
  const stops = segments
    .map((s) => {
      const start = acc;
      acc += s.pct;
      return `${s.color} ${start}% ${acc}%`;
    })
    .join(", ");
  return (
    <div
      className="relative h-[150px] w-[150px] shrink-0 rounded-full"
      style={{ background: `conic-gradient(${stops || "#DCD9CF 0% 100%"})` }}
    >
      <div className="absolute inset-[26%] flex flex-col items-center justify-center rounded-full bg-milk text-center">
        <div className="font-display text-[1.3rem]">{center}</div>
        <div className="text-[8px] uppercase tracking-wide text-ink/55">
          {centerLabel}
        </div>
      </div>
    </div>
  );
}

function Leg({
  color,
  label,
  pct,
}: {
  color: string;
  label: string;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-ink/10 py-2 last:border-0">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="flex-1">{label}</span>
      <span className="font-data text-[12px]">{pct}%</span>
    </div>
  );
}

function FunnelStage({
  tone,
  label,
  count,
  minor,
  note,
}: {
  tone: "risk" | "mid" | "ok";
  label: string;
  count: number;
  minor: number;
  note: string;
}) {
  const bg =
    tone === "risk"
      ? "bg-madder/5"
      : tone === "mid"
        ? "bg-[#C08A3E]/10"
        : "bg-[#7C8770]/10";
  return (
    <div className={`flex-1 px-4 py-4 ${bg}`}>
      <div className="text-[9.5px] uppercase tracking-wide text-ink/55">
        {label}
      </div>
      <div className="mt-1 font-display text-[1.6rem]">{count}</div>
      <div className="mt-1 font-data text-[11px] text-ink/55">
        <Money value={minor} /> · {note}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
        {label}
      </span>
      {children}
    </label>
  );
}

function Crow({
  k,
  v,
  total,
  tone,
}: {
  k: string;
  v: ReactNode;
  total?: boolean;
  tone?: "sage" | "amber";
}) {
  return (
    <div
      className={[
        "flex justify-between py-2 text-[13px]",
        total ? "mt-2 border-t border-ink pt-3" : "border-b border-ink/10",
      ].join(" ")}
    >
      <span className="text-ink/55">{k}</span>
      <span
        className={[
          "font-data",
          tone === "sage"
            ? "text-[#7C8770]"
            : tone === "amber"
              ? "text-[#C08A3E]"
              : "",
        ].join(" ")}
      >
        {v}
      </span>
    </div>
  );
}
