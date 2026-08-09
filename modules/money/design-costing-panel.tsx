"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoney, Money } from "@/modules/ui";

import { saveDesignCosting } from "./actions";
import {
  computeDesignCost,
  formatMarginPercent,
  marginColorClass,
  type RateRow,
} from "./compute";
import type { DesignCostingData } from "./queries";

type DesignCostingPanelProps = {
  data: DesignCostingData;
  canViewMargin: boolean;
  canEdit: boolean;
};

function ratesForKind(rates: RateRow[], kind: RateRow["kind"]) {
  return rates.filter((r) => r.kind === kind);
}

export function DesignCostingPanel({
  data,
  canViewMargin,
  canEdit,
}: DesignCostingPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const initialFabricId =
    data.saved?.fabricId ?? data.fabrics[0]?.id ?? "";
  const [fabricId, setFabricId] = useState(initialFabricId);
  const [fabricMeters, setFabricMeters] = useState(
    String(data.saved?.fabricMeters ?? 0),
  );
  const [embroideryRateId, setEmbroideryRateId] = useState(
    data.saved?.embroideryRateId ?? "",
  );
  const [embroideryFlatMinor, setEmbroideryFlatMinor] = useState(
    data.saved?.embroideryFlatMinor != null
      ? String(data.saved.embroideryFlatMinor)
      : "",
  );
  const [stitchingRateId, setStitchingRateId] = useState(
    data.saved?.stitchingRateId ?? "",
  );
  const [stitchingFlatMinor, setStitchingFlatMinor] = useState(
    data.saved?.stitchingFlatMinor != null
      ? String(data.saved.stitchingFlatMinor)
      : "",
  );
  const [packagingMinor, setPackagingMinor] = useState(
    String(data.saved?.packagingMinor ?? 0),
  );
  const [sellingPriceMinor, setSellingPriceMinor] = useState(
    String(data.saved?.sellingPriceMinor ?? data.basePriceMinor),
  );

  const ratesById = useMemo(
    () => new Map(data.rates.map((r) => [r.id, r])),
    [data.rates],
  );

  const fabric = data.fabrics.find((f) => f.id === fabricId);
  const meters = Number.parseInt(fabricMeters, 10) || 0;
  const packaging = Number.parseInt(packagingMinor, 10) || 0;
  const selling = Number.parseInt(sellingPriceMinor, 10) || 0;

  const breakdown = useMemo(() => {
    if (!fabric) return null;
    return computeDesignCost({
      fabricCostPerMeterMinor: fabric.costPerMeterMinor,
      fabricMeters: meters,
      embroideryRateId: embroideryRateId || null,
      embroideryFlatMinor: embroideryFlatMinor
        ? Number.parseInt(embroideryFlatMinor, 10)
        : null,
      stitchingRateId: stitchingRateId || null,
      stitchingFlatMinor: stitchingFlatMinor
        ? Number.parseInt(stitchingFlatMinor, 10)
        : null,
      packagingMinor: packaging,
      aiCostMinor: data.aiCostMinor,
      sellingPriceMinor: selling,
      ratesById,
    });
  }, [
    fabric,
    meters,
    embroideryRateId,
    embroideryFlatMinor,
    stitchingRateId,
    stitchingFlatMinor,
    packaging,
    data.aiCostMinor,
    selling,
    ratesById,
  ]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    fd.set("designId", data.designId);
    startTransition(async () => {
      const res = await saveDesignCosting(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Costing saved");
      router.refresh();
    });
  }

  return (
    <section className="border border-indigo-lift p-4">
      <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
        Design costing
      </h2>
      <p className="mt-1 text-[12px] text-chalk">
        Select fabric and rates — total cost and margin compute automatically.
        AI spend is pulled from studio generations.
      </p>

      <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Fabric
            </span>
            <select
              name="fabricId"
              value={fabricId}
              disabled={!canEdit}
              onChange={(e) => setFabricId(e.target.value)}
              className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            >
              {data.fabrics.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {formatMoney(f.costPerMeterMinor)}/m
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Metres (hundredths)
            </span>
            <input
              name="fabricMeters"
              type="number"
              min={0}
              required
              disabled={!canEdit}
              value={fabricMeters}
              onChange={(e) => setFabricMeters(e.target.value)}
              className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige"
            />
          </label>

          <RateField
            label="Stitching rate"
            name="stitchingRateId"
            flatName="stitchingFlatMinor"
            rates={ratesForKind(data.rates, "STITCHING")}
            rateId={stitchingRateId}
            flatMinor={stitchingFlatMinor}
            onRateChange={setStitchingRateId}
            onFlatChange={setStitchingFlatMinor}
            disabled={!canEdit}
          />

          <RateField
            label="Embroidery rate"
            name="embroideryRateId"
            flatName="embroideryFlatMinor"
            rates={ratesForKind(data.rates, "EMBROIDERY")}
            rateId={embroideryRateId}
            flatMinor={embroideryFlatMinor}
            onRateChange={setEmbroideryRateId}
            onFlatChange={setEmbroideryFlatMinor}
            disabled={!canEdit}
          />

          <label className="flex flex-col gap-1">
            <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Packaging / trims (paisa)
            </span>
            <input
              name="packagingMinor"
              type="number"
              min={0}
              disabled={!canEdit}
              value={packagingMinor}
              onChange={(e) => setPackagingMinor(e.target.value)}
              className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Selling price (paisa)
            </span>
            <input
              name="sellingPriceMinor"
              type="number"
              min={0}
              required
              disabled={!canEdit}
              value={sellingPriceMinor}
              onChange={(e) => setSellingPriceMinor(e.target.value)}
              className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige"
            />
          </label>
        </div>

        {breakdown ? (
          <div className="border border-indigo-lift p-3">
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Breakdown (computed)
            </p>
            <ul className="mt-2 space-y-1 text-[13px] text-greige">
              <li className="flex justify-between gap-4">
                <span>Fabric</span>
                <Money value={breakdown.fabricMinor} />
              </li>
              <li className="flex justify-between gap-4">
                <span>Stitching</span>
                <Money value={breakdown.stitchingMinor} />
              </li>
              <li className="flex justify-between gap-4">
                <span>Embroidery</span>
                <Money value={breakdown.embroideryMinor} />
              </li>
              <li className="flex justify-between gap-4">
                <span>Packaging</span>
                <Money value={breakdown.packagingMinor} />
              </li>
              <li className="flex justify-between gap-4">
                <span>AI generation</span>
                <Money value={breakdown.aiCostMinor} />
              </li>
              <li className="flex justify-between gap-4 border-t border-indigo-lift pt-1 font-data">
                <span>Total cost</span>
                <Money value={breakdown.totalCostMinor} className="text-zari" />
              </li>
              {canViewMargin ? (
                <li className="flex justify-between gap-4">
                  <span>Margin</span>
                  <span
                    className={`font-data tabular-nums ${marginColorClass(breakdown.marginPercent)}`}
                  >
                    {formatMarginPercent(breakdown.marginPercent)}
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="text-[13px] text-madder" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-[13px] text-zari">{message}</p>
        ) : null}

        {canEdit ? (
          <button
            type="submit"
            disabled={pending || !fabricId}
            className="self-start border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save costing"}
          </button>
        ) : null}
      </form>
    </section>
  );
}

function RateField({
  label,
  name,
  flatName,
  rates,
  rateId,
  flatMinor,
  onRateChange,
  onFlatChange,
  disabled,
}: {
  label: string;
  name: string;
  flatName: string;
  rates: RateRow[];
  rateId: string;
  flatMinor: string;
  onRateChange: (value: string) => void;
  onFlatChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          {label}
        </span>
        <select
          name={name}
          value={rateId}
          disabled={disabled}
          onChange={(e) => onRateChange(e.target.value)}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
        >
          <option value="">None — use flat below</option>
          {rates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {formatMoney(r.amountMinor)} ({r.unit})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Or flat (paisa)
        </span>
        <input
          name={flatName}
          type="number"
          min={0}
          disabled={disabled}
          value={flatMinor}
          onChange={(e) => onFlatChange(e.target.value)}
          placeholder="Overrides rate when set"
          className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige"
        />
      </label>
    </div>
  );
}
