export type RateUnit = "FLAT" | "PER_HOUR" | "PER_METRE";

export type RateRow = {
  id: string;
  kind: "STITCHING" | "EMBROIDERY" | "PACKAGING";
  name: string;
  amountMinor: number;
  unit: RateUnit;
};

export type DesignCostInputs = {
  fabricCostPerMeterMinor: number;
  /** Hundredths of a metre. */
  fabricMeters: number;
  embroideryRateId: string | null;
  embroideryFlatMinor: number | null;
  stitchingRateId: string | null;
  stitchingFlatMinor: number | null;
  packagingMinor: number;
  shippingMinor: number;
  overheadMinor: number;
  aiCostMinor: number;
  sellingPriceMinor: number;
  ratesById: ReadonlyMap<string, RateRow>;
};

export type DesignCostBreakdown = {
  fabricMinor: number;
  embroideryMinor: number;
  stitchingMinor: number;
  packagingMinor: number;
  shippingMinor: number;
  overheadMinor: number;
  aiCostMinor: number;
  totalCostMinor: number;
  sellingPriceMinor: number;
  /** Integer hundredths of a percent (2543 = 25.43%). */
  marginPercent: number;
};

function applyRate(
  rate: RateRow | undefined,
  fabricMeters: number,
): number {
  if (!rate) return 0;
  switch (rate.unit) {
    case "FLAT":
      return rate.amountMinor;
    case "PER_METRE":
      return Math.round((rate.amountMinor * fabricMeters) / 100);
    case "PER_HOUR":
      return rate.amountMinor;
    default:
      return rate.amountMinor;
  }
}

function lineCost(
  flatMinor: number | null,
  rateId: string | null,
  ratesById: ReadonlyMap<string, RateRow>,
  fabricMeters: number,
): number {
  if (flatMinor != null && flatMinor >= 0) return flatMinor;
  if (!rateId) return 0;
  return applyRate(ratesById.get(rateId), fabricMeters);
}

export function computeFabricCostMinor(
  costPerMeterMinor: number,
  fabricMeters: number,
): number {
  if (costPerMeterMinor <= 0 || fabricMeters <= 0) return 0;
  return Math.round((costPerMeterMinor * fabricMeters) / 100);
}

export function computeMarginPercent(
  sellingPriceMinor: number,
  totalCostMinor: number,
): number {
  if (sellingPriceMinor <= 0) return 0;
  return Math.round(
    ((sellingPriceMinor - totalCostMinor) * 10_000) / sellingPriceMinor,
  );
}

export function computeDesignCost(
  input: DesignCostInputs,
): DesignCostBreakdown {
  const fabricMinor = computeFabricCostMinor(
    input.fabricCostPerMeterMinor,
    input.fabricMeters,
  );
  const embroideryMinor = lineCost(
    input.embroideryFlatMinor,
    input.embroideryRateId,
    input.ratesById,
    input.fabricMeters,
  );
  const stitchingMinor = lineCost(
    input.stitchingFlatMinor,
    input.stitchingRateId,
    input.ratesById,
    input.fabricMeters,
  );
  const packagingMinor = Math.max(0, input.packagingMinor);
  const shippingMinor = Math.max(0, input.shippingMinor);
  const overheadMinor = Math.max(0, input.overheadMinor);
  const aiCostMinor = Math.max(0, input.aiCostMinor);
  const totalCostMinor =
    fabricMinor +
    embroideryMinor +
    stitchingMinor +
    packagingMinor +
    shippingMinor +
    overheadMinor +
    aiCostMinor;
  const sellingPriceMinor = Math.max(0, input.sellingPriceMinor);
  const marginPercent = computeMarginPercent(sellingPriceMinor, totalCostMinor);

  return {
    fabricMinor,
    embroideryMinor,
    stitchingMinor,
    packagingMinor,
    shippingMinor,
    overheadMinor,
    aiCostMinor,
    totalCostMinor,
    sellingPriceMinor,
    marginPercent,
  };
}

export type RecurringCostCycle = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

/** Normalize a recurring cost to monthly paisa (integer). */
export function monthlyAmountMinor(
  amountMinor: number,
  cycle: RecurringCostCycle,
): number {
  switch (cycle) {
    case "MONTHLY":
      return amountMinor;
    case "QUARTERLY":
      return Math.round(amountMinor / 3);
    case "YEARLY":
      return Math.round(amountMinor / 12);
    case "WEEKLY":
      return Math.round((amountMinor * 52) / 12);
    default:
      return amountMinor;
  }
}

export function formatMarginPercent(marginPercent: number): string {
  const whole = Math.trunc(marginPercent / 100);
  const frac = Math.abs(marginPercent % 100)
    .toString()
    .padStart(2, "0");
  return `${whole}.${frac}%`;
}

export function marginColorClass(marginPercent: number): string {
  if (marginPercent < 0) return "text-madder";
  if (marginPercent < 1500) return "text-madder";
  if (marginPercent < 3000) return "text-chalk";
  return "text-zari";
}
