import { computeDesignCost, type RateRow } from "./compute";
import type { DesignCostingData } from "./queries";

export type ShadeCostingSaved = {
  fabricId: string;
  fabricMeters: number;
  embroideryRateId: string | null;
  embroideryFlatMinor: number | null;
  stitchingRateId: string | null;
  stitchingFlatMinor: number | null;
  packagingMinor: number;
  shippingMinor: number;
  overheadMinor: number;
  costingMode: string;
  pieceCosts: Array<{
    componentKey: string;
    mode: "DETAILED" | "LUMPSUM";
    fabricId?: string | null;
    fabricMeters?: number;
    stitchingRateId?: string | null;
    stitchingFlatMinor?: number | null;
    embroideryRateId?: string | null;
    embroideryFlatMinor?: number | null;
    lumpsumMinor?: number | null;
  }>;
  totalLumpsumMinor: number | null;
  totalCostMinor: number;
  marginPercent: number;
  sellingPriceMinor: number;
};

type ShadeCostingSource = {
  costingSnapshot?: Record<string, unknown> | null;
};

function isShadeCostingSaved(v: unknown): v is ShadeCostingSaved {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.fabricId === "string" &&
    typeof o.packagingMinor === "number" &&
    typeof o.costingMode === "string" &&
    Array.isArray(o.pieceCosts)
  );
}

export function parseShadeCostingSnapshot(
  raw: Record<string, unknown> | null | undefined,
): ShadeCostingSaved | null {
  if (!raw || !isShadeCostingSaved(raw)) return null;
  return raw;
}

/** Saved costing for one shade — snapshot first, then design-level fallback. */
export function savedCostingForShade(
  shade: ShadeCostingSource,
  designSaved: DesignCostingData["saved"],
): ShadeCostingSaved | null {
  const fromShade = parseShadeCostingSnapshot(shade.costingSnapshot);
  if (fromShade) return fromShade;
  if (!designSaved) return null;
  return {
    fabricId: designSaved.fabricId,
    fabricMeters: designSaved.fabricMeters,
    embroideryRateId: designSaved.embroideryRateId,
    embroideryFlatMinor: designSaved.embroideryFlatMinor,
    stitchingRateId: designSaved.stitchingRateId,
    stitchingFlatMinor: designSaved.stitchingFlatMinor,
    packagingMinor: designSaved.packagingMinor,
    shippingMinor: designSaved.shippingMinor,
    overheadMinor: designSaved.overheadMinor,
    costingMode: designSaved.costingMode,
    pieceCosts: designSaved.pieceCosts,
    totalLumpsumMinor: designSaved.totalLumpsumMinor,
    totalCostMinor: 0,
    marginPercent: 0,
    sellingPriceMinor: designSaved.sellingPriceMinor,
  };
}

export function computeSavedCostBreakdown(
  saved: ShadeCostingSaved,
  data: Pick<DesignCostingData, "fabrics" | "aiCostMinor">,
  ratesById: Map<string, RateRow>,
  sellingPriceMinor: number,
): ReturnType<typeof computeDesignCost> | null {
  const { costingMode, pieceCosts, totalLumpsumMinor } = saved;

  if (costingMode === "TOTAL_LUMPSUM" && totalLumpsumMinor != null) {
    return computeDesignCost({
      fabricCostPerMeterMinor: 0,
      fabricMeters: 0,
      embroideryRateId: null,
      embroideryFlatMinor: totalLumpsumMinor,
      stitchingRateId: null,
      stitchingFlatMinor: 0,
      packagingMinor: saved.packagingMinor,
      shippingMinor: saved.shippingMinor,
      overheadMinor: saved.overheadMinor,
      aiCostMinor: data.aiCostMinor,
      sellingPriceMinor,
      ratesById,
    });
  }

  let metres = 0;
  let stitch = 0;
  let emb = 0;
  let fabricId = saved.fabricId;
  for (const piece of pieceCosts) {
    if (piece.mode === "LUMPSUM") {
      emb += Math.max(0, piece.lumpsumMinor ?? 0);
    } else {
      metres += Math.max(0, piece.fabricMeters ?? 0);
      stitch += Math.max(0, piece.stitchingFlatMinor ?? 0);
      emb += Math.max(0, piece.embroideryFlatMinor ?? 0);
      if (piece.fabricId) fabricId = piece.fabricId;
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
    packagingMinor: saved.packagingMinor,
    shippingMinor: saved.shippingMinor,
    overheadMinor: saved.overheadMinor,
    aiCostMinor: data.aiCostMinor,
    sellingPriceMinor,
    ratesById,
  });
}

export function costingBreakdownForShade(
  shade: ShadeCostingSource & { basePriceMinor?: number | null },
  designBasePriceMinor: number,
  data: DesignCostingData,
): ReturnType<typeof computeDesignCost> | null {
  const saved = savedCostingForShade(shade, data.saved);
  if (!saved) return data.breakdown;

  const ratesById = new Map(data.rates.map((r) => [r.id, r]));
  const selling =
    (shade.basePriceMinor ?? designBasePriceMinor) || saved.sellingPriceMinor;
  return computeSavedCostBreakdown(saved, data, ratesById, selling);
}
