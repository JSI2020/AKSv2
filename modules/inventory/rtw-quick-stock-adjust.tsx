"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recordStockMovement } from "./record-movement-action";

type SizeRow = {
  label: string;
  onHand: number;
  stockId: string;
};

export function RtwQuickStockAdjust({
  designName,
  colourwayName,
  sizes,
}: {
  designName: string;
  colourwayName: string;
  sizes: SizeRow[];
}) {
  const router = useRouter();
  const [sizeLabel, setSizeLabel] = useState(sizes[0]?.label ?? "M");
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"receive" | "set">("receive");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = sizes.find((s) => s.label === sizeLabel);

  function onSubmit() {
    setError(null);
    if (!selected) {
      setError("Pick a size");
      return;
    }
    const n = Number.parseInt(qty, 10);
    if (!Number.isInteger(n) || n <= 0) {
      setError("Enter a positive whole number");
      return;
    }

    startTransition(async () => {
      if (mode === "receive") {
        const res = await recordStockMovement({
          stockKind: "rtw",
          stockId: selected.stockId,
          type: "RECEIVED",
          quantity: n,
          note: note.trim() || `${designName} — ${colourwayName} ${sizeLabel}`,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      } else {
        const delta = n - selected.onHand;
        if (delta === 0) {
          setError("Quantity already matches on hand");
          return;
        }
        const res = await recordStockMovement({
          stockKind: "rtw",
          stockId: selected.stockId,
          type: "COUNT_CORRECTION",
          quantity: Math.abs(delta),
          correctionSign: delta > 0 ? "+" : "-",
          note: note.trim() || `Set count to ${n}`,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      setQty("");
      setNote("");
      router.refresh();
    });
  }

  if (sizes.length === 0) return null;

  return (
    <div className="border border-ink/12 bg-milk p-4">
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink/55">
        Adjust stock — {colourwayName}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[5rem] flex-col gap-1 text-[12px] text-ink/55">
          Size
          <select
            value={sizeLabel}
            onChange={(e) => setSizeLabel(e.target.value)}
            className="border border-ink/12 bg-milk px-2 py-2 text-[13px] text-ink"
          >
            {sizes.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label} ({s.onHand} on hand)
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[7rem] flex-col gap-1 text-[12px] text-ink/55">
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "receive" | "set")}
            className="border border-ink/12 bg-milk px-2 py-2 text-[13px] text-ink"
          >
            <option value="receive">Add received</option>
            <option value="set">Set exact count</option>
          </select>
        </label>
        <label className="flex min-w-[5rem] flex-col gap-1 text-[12px] text-ink/55">
          {mode === "receive" ? "Add qty" : "New on-hand"}
          <input
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="border border-ink/12 bg-milk px-2 py-2 text-[13px] text-ink"
            placeholder={mode === "receive" ? "5" : String(selected?.onHand ?? 0)}
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[12px] text-ink/55">
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border border-ink/12 bg-milk px-2 py-2 text-[13px] text-ink"
            placeholder="Opening stock, count check…"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={onSubmit}
          className="border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.06em] text-milk disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "receive" ? "Receive" : "Update count"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-[12px] text-madder">{error}</p>
      ) : (
        <p className="mt-3 text-[11.5px] text-ink/45">
          Movements are logged on the size ledger. Click a size tile above for full history.
        </p>
      )}
    </div>
  );
}
