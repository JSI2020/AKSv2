"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";

import { AdminNuqsProvider } from "@/modules/admin/shell/nuqs-provider";
import {
  AdminTimeFilter,
  resolveTimeRange,
  timeRangeNuqsParsers,
} from "@/modules/admin/time-filter";

import {
  movementLabel,
  movementTone,
  type ManualMovementType,
  type StockLedgerDetail,
} from "./ledger-types";
import { recordStockMovement } from "./record-movement-action";

function formatQty(value: number, unit: "pcs" | "m"): string {
  if (unit === "m") {
    return `${(value / 100).toFixed(1)} m`;
  }
  return String(value);
}

function formatDelta(delta: number, unit: "pcs" | "m"): string {
  const sign = delta > 0 ? "+" : "";
  if (unit === "m") {
    return `${sign}${(delta / 100).toFixed(1)}`;
  }
  return `${sign}${delta}`;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(d instanceof Date ? d : new Date(d));
}

function StockLedgerHistory({ detail }: { detail: StockLedgerDetail }) {
  const [params] = useQueryStates(timeRangeNuqsParsers, {
    history: "push",
    shallow: false,
  });
  const range = useMemo(
    () =>
      resolveTimeRange({
        preset: params.range,
        fromKey: params.from,
        toKey: params.to,
      }),
    [params.range, params.from, params.to],
  );
  const movements = useMemo(() => {
    const fromMs = range.from.getTime();
    const toMs = range.to.getTime();
    return detail.movements.filter((m) => {
      const t = new Date(m.createdAt).getTime();
      return t >= fromMs && t <= toMs;
    });
  }, [detail.movements, range.from, range.to]);

  return (
    <>
      <div className="mb-4">
        <AdminTimeFilter />
      </div>
      {detail.movements.length === 0 ? (
        <p className="text-[13px] text-ink/45">No movements yet.</p>
      ) : movements.length === 0 ? (
        <p className="text-[13px] text-ink/45">
          No movements in this time range.
        </p>
      ) : (
        <div className="flex flex-col">
          {movements.map((m) => {
            const tone = movementTone(m.delta);
            return (
              <div
                key={m.id}
                className="grid grid-cols-[5.5rem_1fr_4.5rem_1fr] items-center gap-3 border-b border-ink/10 py-3 text-[12.5px] last:border-b-0"
              >
                <span className="font-data text-[11px] text-ink/55">
                  {formatDate(m.createdAt)}
                </span>
                <span
                  className={
                    tone === "in"
                      ? "w-fit bg-sage/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-ink"
                      : tone === "out"
                        ? "w-fit bg-madder/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-madder"
                        : "w-fit bg-zari/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-zari"
                  }
                >
                  {movementLabel(m.reason)}
                </span>
                <span className="text-end font-data text-ink">
                  {formatDelta(m.delta, detail.figures.unit)}
                </span>
                <span className="text-[11.5px] text-ink/55">
                  {m.reference ?? m.note ?? "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function StockLedgerView({ detail }: { detail: StockLedgerDetail }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<ManualMovementType>("RECEIVED");
  const [qty, setQty] = useState("");
  const [correctionSign, setCorrectionSign] = useState<"+" | "-">("+");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { figures } = detail;
  const availableLow =
    figures.available <= 0 ||
    (figures.unit === "pcs" && figures.available <= 2);

  function onSubmit() {
    setError(null);
    let quantity: number;
    if (figures.unit === "m") {
      const metres = Number.parseFloat(qty);
      if (!Number.isFinite(metres) || metres <= 0) {
        setError("Enter metres as a positive number");
        return;
      }
      quantity = Math.round(metres * 100);
      if (quantity <= 0) {
        setError("Enter metres as a positive number");
        return;
      }
    } else {
      const n = Number.parseInt(qty, 10);
      if (!Number.isInteger(n) || n <= 0) {
        setError("Enter a positive quantity");
        return;
      }
      quantity = n;
    }
    startTransition(async () => {
      const res = await recordStockMovement({
        stockKind: detail.stockKind,
        stockId: detail.stockId,
        type,
        quantity,
        correctionSign: type === "COUNT_CORRECTION" ? correctionSign : undefined,
        note: note.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFormOpen(false);
      setQty("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <AdminNuqsProvider>
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <div
            className="aspect-[4/5] border border-ink/12 bg-greige/40"
            style={
              detail.photoUrl
                ? undefined
                : detail.photoGradient
                  ? { background: detail.photoGradient }
                  : undefined
            }
          >
            {detail.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.photoUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-px border border-ink/12 bg-ink/12">
            <div className="bg-milk px-3 py-4 text-center">
              <p className="font-sans text-[9.5px] uppercase tracking-[0.1em] text-ink/55">
                On hand
              </p>
              <p
                className={`mt-1.5 font-display text-[2rem] font-light leading-none ${
                  availableLow ? "text-madder" : "text-ink"
                }`}
              >
                {formatQty(figures.onHand, figures.unit)}
              </p>
            </div>
            <div className="bg-milk px-3 py-4 text-center">
              <p className="font-sans text-[9.5px] uppercase tracking-[0.1em] text-ink/55">
                Reserved
              </p>
              <p className="mt-1.5 font-display text-[2rem] font-light leading-none text-ink">
                {formatQty(figures.reserved, figures.unit)}
              </p>
            </div>
            <div className="bg-milk px-3 py-4 text-center">
              <p className="font-sans text-[9.5px] uppercase tracking-[0.1em] text-ink/55">
                Available
              </p>
              <p
                className={`mt-1.5 font-display text-[2rem] font-light leading-none ${
                  availableLow ? "text-madder" : "text-ink"
                }`}
              >
                {formatQty(figures.available, figures.unit)}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h1 className="font-display text-[2rem] font-light text-ink">
            {detail.title}
          </h1>
          <p className="mt-1 text-[13px] text-ink/55">{detail.subtitle}</p>

          <section className="mt-5 border border-ink/12 bg-milk px-5 py-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
                Movement history
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen((o) => !o)}
                className="bg-ink px-3.5 py-2 text-[11px] uppercase tracking-[0.08em] text-milk hover:bg-madder"
              >
                + Record movement
              </button>
            </div>

            {formOpen ? (
              <div className="mb-4 border-t border-ink/12 pt-4">
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="font-sans text-[10px] uppercase tracking-[0.1em] text-ink/55">
                      Type
                    </span>
                    <select
                      value={type}
                      onChange={(e) =>
                        setType(e.target.value as ManualMovementType)
                      }
                      className="border border-ink/12 bg-greige/40 px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
                    >
                      <option value="RECEIVED">Received (new stock in)</option>
                      <option value="SOLD_OFFLINE">Sold offline</option>
                      <option value="DAMAGE">Damaged / write-off</option>
                      <option value="COUNT_CORRECTION">Count correction</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-sans text-[10px] uppercase tracking-[0.1em] text-ink/55">
                      Quantity{figures.unit === "m" ? " (metres)" : ""}
                    </span>
                    <div className="flex gap-2">
                      {type === "COUNT_CORRECTION" ? (
                        <select
                          value={correctionSign}
                          onChange={(e) =>
                            setCorrectionSign(e.target.value as "+" | "-")
                          }
                          className="border border-ink/12 bg-greige/40 px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        >
                          <option value="+">+</option>
                          <option value="-">−</option>
                        </select>
                      ) : null}
                      <input
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        inputMode={figures.unit === "m" ? "decimal" : "numeric"}
                        placeholder={
                          figures.unit === "m" ? "e.g. 10" : "e.g. 10"
                        }
                        className="min-w-0 flex-1 border border-ink/12 bg-greige/40 px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
                      />
                    </div>
                  </label>
                </div>
                <label className="mb-3 flex flex-col gap-1.5">
                  <span className="font-sans text-[10px] uppercase tracking-[0.1em] text-ink/55">
                    Note (optional)
                  </span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Received from supplier, invoice #2214"
                    className="border border-ink/12 bg-greige/40 px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
                  />
                </label>
                {error ? (
                  <p className="mb-2 text-[12px] text-madder" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="border border-ink/12 px-3.5 py-2 text-[11px] uppercase tracking-[0.08em] text-ink/55"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onSubmit}
                    className="bg-ink px-3.5 py-2 text-[11px] uppercase tracking-[0.08em] text-milk disabled:opacity-50"
                  >
                    Save movement
                  </button>
                </div>
              </div>
            ) : null}

            <StockLedgerHistory detail={detail} />
          </section>
        </div>
      </div>
    </AdminNuqsProvider>
  );
}
