"use client";

import { useMemo, useState, useTransition } from "react";

import { Money } from "@/modules/ui";

import { recordCodRemittanceAction } from "@/modules/payments/cod/actions";

import type { CodRemittanceRow } from "@/modules/payments/cod/queries";

type RemittableOrder = {
  orderId: string;
  orderNumber: string;
  balanceMinor: number;
  customerName: string;
};

type OutstandingOrder = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  balanceMinor: number;
  deliveredAt: Date | null;
};

type Props = {
  remittances: CodRemittanceRow[];
  remittableOrders: RemittableOrder[];
  outstandingOrders: OutstandingOrder[];
};

export function CodRemittancePanel({
  remittances: initialRemittances,
  remittableOrders,
  outstandingOrders,
}: Props) {
  const [remittances, setRemittances] = useState(initialRemittances);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [courier, setCourier] = useState("TCS");
  const [remittanceRef, setRemittanceRef] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const expectedMinor = useMemo(() => {
    let sum = 0;
    for (const order of remittableOrders) {
      if (selected.has(order.orderId)) sum += order.balanceMinor;
    }
    return sum;
  }, [remittableOrders, selected]);

  function toggleOrder(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const receivedMinor = Math.round(parseFloat(receivedAmount) * 100);
    if (!Number.isFinite(receivedMinor) || receivedMinor < 0) {
      setError("Enter a valid received amount in PKR.");
      return;
    }

    startTransition(async () => {
      const result = await recordCodRemittanceAction({
        courier,
        remittanceRef,
        expectedAmountMinor: expectedMinor,
        receivedAmountMinor: receivedMinor,
        receivedAt,
        orderIds: [...selected],
        discrepancyNote: discrepancyNote || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Remittance recorded.");
      setSelected(new Set());
      setRemittanceRef("");
      setReceivedAmount("");
      setDiscrepancyNote("");
      setRemittances((prev) => [
        {
          id: result.remittanceId,
          courier,
          remittanceRef,
          expectedAmountMinor: expectedMinor,
          receivedAmountMinor: receivedMinor,
          receivedAt: new Date(receivedAt),
          orderIds: [...selected],
          discrepancyNote: discrepancyNote || null,
          hasDiscrepancy: expectedMinor !== receivedMinor,
        },
        ...prev,
      ]);
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[12px] uppercase tracking-[0.08em] text-chalk">
          Outstanding COD
        </h2>
        <p className="mt-1 text-[13px] text-chalk">
          Delivered orders with balance collected — not yet matched to a
          courier remittance.
        </p>
        {outstandingOrders.length === 0 ? (
          <p className="mt-3 text-[13px] text-greige">Nothing outstanding.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {outstandingOrders.map((order) => (
              <li
                key={order.orderId}
                className="flex items-center justify-between border border-indigo-lift px-3 py-2 text-[13px]"
              >
                <span>
                  {order.orderNumber} · {order.customerName}
                </span>
                <Money value={order.balanceMinor} className="text-greige" />
              </li>
            ))}
          </ul>
        )}
        {outstandingOrders.length > 0 ? (
          <p className="mt-2 text-[12px] text-chalk">
            Total exposure{" "}
            <Money
              value={outstandingOrders.reduce((s, o) => s + o.balanceMinor, 0)}
              className="inline text-greige"
            />
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-[12px] uppercase tracking-[0.08em] text-chalk">
          Record remittance
        </h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-[12px] text-chalk">
              Courier
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="mt-1 w-full border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
              >
                <option value="TCS">TCS</option>
                <option value="LEOPARDS">Leopards</option>
                <option value="MP">M&amp;P</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="block text-[12px] text-chalk">
              Remittance reference
              <input
                value={remittanceRef}
                onChange={(e) => setRemittanceRef(e.target.value)}
                className="mt-1 w-full border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
              />
            </label>
            <label className="block text-[12px] text-chalk">
              Received (PKR)
              <input
                type="number"
                min={0}
                step="0.01"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="mt-1 w-full border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
              />
            </label>
            <label className="block text-[12px] text-chalk">
              Received date
              <input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="mt-1 w-full border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
              />
            </label>
          </div>

          <fieldset className="border border-indigo-lift p-3">
            <legend className="px-1 text-[12px] text-chalk">
              Match orders ({selected.size} selected · expected{" "}
              <Money value={expectedMinor} className="inline text-greige" />)
            </legend>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {remittableOrders.map((order) => (
                <li key={order.orderId}>
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-greige">
                    <input
                      type="checkbox"
                      checked={selected.has(order.orderId)}
                      onChange={() => toggleOrder(order.orderId)}
                    />
                    {order.orderNumber} · {order.customerName} ·{" "}
                    <Money value={order.balanceMinor} className="inline" />
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <label className="block text-[12px] text-chalk">
            Discrepancy note (optional)
            <textarea
              rows={2}
              value={discrepancyNote}
              onChange={(e) => setDiscrepancyNote(e.target.value)}
              className="mt-1 w-full border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            />
          </label>

          {error ? (
            <p className="text-[13px] text-madder" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-[13px] text-greige">{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending || selected.size === 0}
            className="border border-zari bg-zari px-4 py-2 text-[12px] uppercase tracking-[0.06em] text-indigo disabled:opacity-40"
          >
            Record remittance
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-[12px] uppercase tracking-[0.08em] text-chalk">
          Past remittances
        </h2>
        {remittances.length === 0 ? (
          <p className="mt-3 text-[13px] text-chalk">None recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {remittances.map((row) => (
              <li
                key={row.id}
                className={
                  row.hasDiscrepancy
                    ? "border border-madder px-3 py-2 text-[13px] text-greige"
                    : "border border-indigo-lift px-3 py-2 text-[13px] text-greige"
                }
              >
                <p>
                  {row.courier} · {row.remittanceRef} ·{" "}
                  {row.receivedAt.toLocaleDateString()}
                </p>
                <p className="mt-1 text-chalk">
                  Expected{" "}
                  <Money value={row.expectedAmountMinor} className="inline" /> ·
                  Received{" "}
                  <Money value={row.receivedAmountMinor} className="inline" /> ·{" "}
                  {row.orderIds.length} orders
                </p>
                {row.discrepancyNote ? (
                  <p className="mt-1 text-[12px] text-madder">
                    {row.discrepancyNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
