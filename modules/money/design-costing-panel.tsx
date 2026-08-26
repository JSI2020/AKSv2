"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoney, Money } from "@/modules/ui";

import { saveDesignCosting } from "./actions";
import {
  computeDesignCost,
  formatMarginPercent,
  marginColorClass,
} from "./compute";
import type { DesignCostingData } from "./queries";
import { CostStackBar } from "@/modules/admin/viz";

type DesignCostingPanelProps = {
  data: DesignCostingData;
  canViewMargin: boolean;
  canEdit: boolean;
  pieceKeys?: string[];
  onSavedAdvance?: () => void;
};

type CostingMode = "DETAILED_PER_PIECE" | "PIECE_LUMPSUM" | "TOTAL_LUMPSUM";

type PieceDraft = {
  componentKey: string;
  mode: "DETAILED" | "LUMPSUM";
  fabricId: string;
  fabricMetres: string;
  stitchingFlatPkr: string;
  embroideryFlatPkr: string;
  lumpsumPkr: string;
};

function pkrToPaisa(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isInteger(n) && n >= 0 ? n * 100 : -1;
}

function metresToHundredths(raw: string): number {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return -1;
  return Math.round(n * 100);
}

function fieldClass() {
  return "border border-ink/12 bg-milk px-3 py-2 text-[13px] text-ink outline-none focus:border-ink disabled:opacity-50";
}

function initPieces(
  data: DesignCostingData,
  keys: string[],
): PieceDraft[] {
  const saved = data.saved?.pieceCosts ?? [];
  if (saved.length > 0) {
    return saved.map((p) => ({
      componentKey: p.componentKey,
      mode: p.mode,
      fabricId: p.fabricId ?? data.fabrics[0]?.id ?? "",
      fabricMetres:
        p.fabricMeters != null ? (p.fabricMeters / 100).toFixed(2) : "0",
      stitchingFlatPkr:
        p.stitchingFlatMinor != null
          ? String(Math.round(p.stitchingFlatMinor / 100))
          : "",
      embroideryFlatPkr:
        p.embroideryFlatMinor != null
          ? String(Math.round(p.embroideryFlatMinor / 100))
          : "",
      lumpsumPkr:
        p.lumpsumMinor != null ? String(Math.round(p.lumpsumMinor / 100)) : "",
    }));
  }
  return keys.map((key, i) => ({
    componentKey: key,
    mode: "DETAILED" as const,
    fabricId: data.saved?.fabricId ?? data.fabrics[0]?.id ?? "",
    fabricMetres:
      i === 0 && data.saved
        ? (data.saved.fabricMeters / 100).toFixed(2)
        : "0",
    stitchingFlatPkr:
      i === 0 && data.saved?.stitchingFlatMinor != null
        ? String(Math.round(data.saved.stitchingFlatMinor / 100))
        : "",
    embroideryFlatPkr:
      i === 0 && data.saved?.embroideryFlatMinor != null
        ? String(Math.round(data.saved.embroideryFlatMinor / 100))
        : "",
    lumpsumPkr: "",
  }));
}

export function DesignCostingPanel({
  data,
  canViewMargin,
  canEdit,
  pieceKeys,
  onSavedAdvance,
}: DesignCostingPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const keys =
    pieceKeys && pieceKeys.length > 0
      ? pieceKeys
      : data.components.length > 0
        ? data.components
        : ["PRIMARY"];

  const [mode, setMode] = useState<CostingMode>(
    (data.saved?.costingMode as CostingMode) ?? "DETAILED_PER_PIECE",
  );
  const [pieces, setPieces] = useState(() => initPieces(data, keys));
  const [totalLumpsumPkr, setTotalLumpsumPkr] = useState(
    data.saved?.totalLumpsumMinor != null
      ? String(Math.round(data.saved.totalLumpsumMinor / 100))
      : "",
  );
  const [packagingPkr, setPackagingPkr] = useState(
    String(Math.round((data.saved?.packagingMinor ?? 0) / 100)),
  );
  const [shippingPkr, setShippingPkr] = useState(
    String(Math.round((data.saved?.shippingMinor ?? 0) / 100)),
  );
  const [overheadPkr, setOverheadPkr] = useState(
    String(Math.round((data.saved?.overheadMinor ?? 0) / 100)),
  );

  const ratesById = useMemo(
    () => new Map(data.rates.map((r) => [r.id, r])),
    [data.rates],
  );

  const packaging = pkrToPaisa(packagingPkr);
  const shipping = pkrToPaisa(shippingPkr);
  const overhead = pkrToPaisa(overheadPkr);
  const selling = data.basePriceMinor;

  const breakdown = useMemo(() => {
    if (packaging < 0 || shipping < 0 || overhead < 0) return null;

    if (mode === "TOTAL_LUMPSUM") {
      const lump = pkrToPaisa(totalLumpsumPkr);
      if (lump < 0) return null;
      return computeDesignCost({
        fabricCostPerMeterMinor: 0,
        fabricMeters: 0,
        embroideryRateId: null,
        embroideryFlatMinor: lump,
        stitchingRateId: null,
        stitchingFlatMinor: 0,
        packagingMinor: packaging,
        shippingMinor: shipping,
        overheadMinor: overhead,
        aiCostMinor: data.aiCostMinor,
        sellingPriceMinor: selling,
        ratesById,
      });
    }

    let metres = 0;
    let stitch = 0;
    let emb = 0;
    let fabricId = pieces[0]?.fabricId ?? data.fabrics[0]?.id ?? "";
    for (const p of pieces) {
      if (mode === "PIECE_LUMPSUM" || p.mode === "LUMPSUM") {
        const lump = pkrToPaisa(p.lumpsumPkr || "0");
        if (lump < 0) return null;
        emb += lump;
      } else {
        const m = metresToHundredths(p.fabricMetres);
        if (m < 0) return null;
        metres += m;
        const sf = p.stitchingFlatPkr.trim()
          ? pkrToPaisa(p.stitchingFlatPkr)
          : 0;
        const ef = p.embroideryFlatPkr.trim()
          ? pkrToPaisa(p.embroideryFlatPkr)
          : 0;
        if (sf < 0 || ef < 0) return null;
        stitch += sf;
        emb += ef;
        if (p.fabricId) fabricId = p.fabricId;
      }
    }
    const fabric = data.fabrics.find((f) => f.id === fabricId);
    if (!fabric) return null;
    return computeDesignCost({
      fabricCostPerMeterMinor: fabric.costPerMeterMinor,
      fabricMeters: metres,
      embroideryRateId: null,
      embroideryFlatMinor: emb,
      stitchingRateId: null,
      stitchingFlatMinor: stitch,
      packagingMinor: packaging,
      shippingMinor: shipping,
      overheadMinor: overhead,
      aiCostMinor: data.aiCostMinor,
      sellingPriceMinor: selling,
      ratesById,
    });
  }, [
    mode,
    pieces,
    totalLumpsumPkr,
    packaging,
    shipping,
    overhead,
    selling,
    data,
    ratesById,
  ]);

  function updatePiece(idx: number, patch: Partial<PieceDraft>) {
    setPieces((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setError(null);
    setMessage(null);

    const pack = pkrToPaisa(packagingPkr);
    const ship = pkrToPaisa(shippingPkr);
    const over = pkrToPaisa(overheadPkr);
    if (pack < 0 || ship < 0 || over < 0) {
      setError("Enter whole PKR amounts ≥ 0");
      return;
    }

    const piecePayload = pieces.map((p) => {
      const pieceMode: "DETAILED" | "LUMPSUM" =
        mode === "PIECE_LUMPSUM" ? "LUMPSUM" : p.mode;
      if (pieceMode === "LUMPSUM") {
        return {
          componentKey: p.componentKey,
          mode: "LUMPSUM" as const,
          lumpsumMinor: Math.max(0, pkrToPaisa(p.lumpsumPkr || "0")),
        };
      }
      return {
        componentKey: p.componentKey,
        mode: "DETAILED" as const,
        fabricId: p.fabricId,
        fabricMeters: Math.max(0, metresToHundredths(p.fabricMetres)),
        stitchingFlatMinor: p.stitchingFlatPkr.trim()
          ? Math.max(0, pkrToPaisa(p.stitchingFlatPkr))
          : null,
        embroideryFlatMinor: p.embroideryFlatPkr.trim()
          ? Math.max(0, pkrToPaisa(p.embroideryFlatPkr))
          : null,
      };
    });

    const primaryFabric =
      piecePayload.find((p) => p.mode === "DETAILED" && p.fabricId)?.fabricId ??
      pieces[0]?.fabricId ??
      data.fabrics[0]?.id ??
      "";

    const fd = new FormData();
    fd.set("designId", data.designId);
    fd.set("fabricId", primaryFabric);
    fd.set("fabricMeters", "0");
    fd.set("embroideryRateId", "");
    fd.set("embroideryFlatMinor", "");
    fd.set("stitchingRateId", "");
    fd.set("stitchingFlatMinor", "");
    fd.set("packagingMinor", String(pack));
    fd.set("shippingMinor", String(ship));
    fd.set("overheadMinor", String(over));
    fd.set("costingMode", mode);
    fd.set("pieceCostsJson", JSON.stringify(piecePayload));
    if (mode === "TOTAL_LUMPSUM") {
      const lump = pkrToPaisa(totalLumpsumPkr);
      if (lump < 0) {
        setError("Enter total lumpsum in PKR");
        return;
      }
      fd.set("totalLumpsumMinor", String(lump));
    }

    startTransition(async () => {
      const res = await saveDesignCosting(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Costing saved");
      router.refresh();
      onSavedAdvance?.();
    });
  }

  return (
    <section>
      <p className="text-[13px] text-ink/55">
        Cost each piece (kameez, trouser, …) in detail or as lumpsum — or one
        total lumpsum. Packaging, shipping, and overhead stay separate. Selling
        price is set on the Price tab (used for margin).
      </p>

      <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["DETAILED_PER_PIECE", "Detailed per piece"],
              ["PIECE_LUMPSUM", "Lumpsum per piece"],
              ["TOTAL_LUMPSUM", "Total lumpsum"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={!canEdit}
              onClick={() => setMode(id)}
              className={
                mode === id
                  ? "bg-zari px-3 py-1.5 text-[12px] text-indigo"
                  : "border border-ink/12 px-3 py-1.5 text-[12px] text-ink/55"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "TOTAL_LUMPSUM" ? (
          <label className="flex max-w-xs flex-col gap-1">
            <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
              Total garment cost (PKR)
            </span>
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={totalLumpsumPkr}
              onChange={(e) => setTotalLumpsumPkr(e.target.value)}
              className={fieldClass()}
            />
          </label>
        ) : (
          <div className="flex flex-col gap-4">
            {pieces.map((piece, idx) => (
              <div
                key={piece.componentKey}
                className="border border-ink/10 bg-milk p-4"
              >
                <p className="font-data text-[11px] uppercase tracking-[0.12em] text-ink/45">
                  Piece · {piece.componentKey}
                </p>
                {mode === "DETAILED_PER_PIECE" ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
                        Fabric
                      </span>
                      <select
                        value={piece.fabricId}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updatePiece(idx, { fabricId: e.target.value })
                        }
                        className={fieldClass()}
                      >
                        {data.fabrics.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} · {formatMoney(f.costPerMeterMinor)}/m
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
                        Metres
                      </span>
                      <input
                        value={piece.fabricMetres}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updatePiece(idx, { fabricMetres: e.target.value })
                        }
                        className={fieldClass()}
                        placeholder="2.50"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
                        Stitching (PKR)
                      </span>
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        value={piece.stitchingFlatPkr}
                        onChange={(e) =>
                          updatePiece(idx, {
                            stitchingFlatPkr: e.target.value,
                          })
                        }
                        className={fieldClass()}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
                        Embroidery (PKR)
                      </span>
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        value={piece.embroideryFlatPkr}
                        onChange={(e) =>
                          updatePiece(idx, {
                            embroideryFlatPkr: e.target.value,
                          })
                        }
                        className={fieldClass()}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="mt-3 flex max-w-xs flex-col gap-1">
                    <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
                      Piece lumpsum (PKR)
                    </span>
                    <input
                      type="number"
                      min={0}
                      disabled={!canEdit}
                      value={piece.lumpsumPkr}
                      onChange={(e) =>
                        updatePiece(idx, { lumpsumPkr: e.target.value })
                      }
                      className={fieldClass()}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
              Packaging (PKR)
            </span>
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={packagingPkr}
              onChange={(e) => setPackagingPkr(e.target.value)}
              className={fieldClass()}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
              Shipping (PKR)
            </span>
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={shippingPkr}
              onChange={(e) => setShippingPkr(e.target.value)}
              className={fieldClass()}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
              Overhead (PKR)
            </span>
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={overheadPkr}
              onChange={(e) => setOverheadPkr(e.target.value)}
              className={fieldClass()}
            />
          </label>
        </div>

        {breakdown ? (
          <div className="flex flex-col gap-3 border border-ink/10 p-3">
            <CostStackBar
              segments={[
                {
                  key: "make",
                  label: "Fabric / pieces",
                  minor:
                    breakdown.fabricMinor +
                    breakdown.stitchingMinor +
                    breakdown.embroideryMinor,
                  tone: "ink",
                },
                {
                  key: "pack",
                  label: "Packaging",
                  minor: breakdown.packagingMinor,
                  tone: "chalk",
                },
                {
                  key: "ship",
                  label: "Shipping",
                  minor: breakdown.shippingMinor,
                  tone: "zari",
                },
                {
                  key: "oh",
                  label: "Overhead",
                  minor: breakdown.overheadMinor,
                  tone: "chalk",
                },
                {
                  key: "ai",
                  label: "AI generation",
                  minor: breakdown.aiCostMinor,
                  tone: "madder",
                },
              ]}
              sellMinor={selling}
              costMinor={breakdown.totalCostMinor}
              marginPercent={breakdown.marginPercent}
              showMargin={canViewMargin}
            />
            <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
              Line items
            </p>
            <ul className="space-y-1 text-[13px] text-ink">
              <li className="flex justify-between gap-4">
                <span>Fabric / pieces</span>
                <Money
                  value={
                    breakdown.fabricMinor +
                    breakdown.stitchingMinor +
                    breakdown.embroideryMinor
                  }
                />
              </li>
              <li className="flex justify-between gap-4">
                <span>Packaging</span>
                <Money value={breakdown.packagingMinor} />
              </li>
              <li className="flex justify-between gap-4">
                <span>Shipping</span>
                <Money value={breakdown.shippingMinor} />
              </li>
              <li className="flex justify-between gap-4">
                <span>Overhead</span>
                <Money value={breakdown.overheadMinor} />
              </li>
              {breakdown.aiCostMinor > 0 ? (
                <li className="flex justify-between gap-4">
                  <span>AI generation</span>
                  <Money value={breakdown.aiCostMinor} />
                </li>
              ) : null}
              <li className="flex justify-between gap-4 border-t border-ink/10 pt-1 font-data">
                <span>Total cost</span>
                <Money value={breakdown.totalCostMinor} className="text-zari" />
              </li>
              {canViewMargin ? (
                <li className="flex justify-between gap-4">
                  <span>Margin vs retail</span>
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
            disabled={pending}
            className="self-start border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save · continue to Price"}
          </button>
        ) : null}
      </form>
    </section>
  );
}
