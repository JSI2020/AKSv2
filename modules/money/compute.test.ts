import { describe, expect, it } from "vitest";

import {
  computeDesignCost,
  computeFabricCostMinor,
  computeMarginPercent,
  monthlyAmountMinor,
} from "./compute";

describe("money compute", () => {
  const ratesById = new Map([
    [
      "stitch-flat",
      {
        id: "stitch-flat",
        kind: "STITCHING" as const,
        name: "Standard stitch",
        amountMinor: 500_000,
        unit: "FLAT" as const,
      },
    ],
    [
      "emb-metre",
      {
        id: "emb-metre",
        kind: "EMBROIDERY" as const,
        name: "Per metre",
        amountMinor: 100_000,
        unit: "PER_METRE" as const,
      },
    ],
  ]);

  it("fabric cost = metres × cost/metre", () => {
    expect(computeFabricCostMinor(50_000, 450)).toBe(225_000);
  });

  it("computes total cost and margin from selections", () => {
    const result = computeDesignCost({
      fabricCostPerMeterMinor: 50_000,
      fabricMeters: 450,
      embroideryRateId: "emb-metre",
      embroideryFlatMinor: null,
      stitchingRateId: "stitch-flat",
      stitchingFlatMinor: null,
      packagingMinor: 25_000,
      shippingMinor: 0,
      overheadMinor: 0,
      aiCostMinor: 10_000,
      sellingPriceMinor: 1_500_000,
      ratesById,
    });

    expect(result.fabricMinor).toBe(225_000);
    expect(result.stitchingMinor).toBe(500_000);
    expect(result.embroideryMinor).toBe(450_000);
    expect(result.totalCostMinor).toBe(1_210_000);
    expect(result.marginPercent).toBe(1933);
  });

  it("flat override wins over rate", () => {
    const result = computeDesignCost({
      fabricCostPerMeterMinor: 10_000,
      fabricMeters: 100,
      embroideryRateId: "emb-metre",
      embroideryFlatMinor: 99_999,
      stitchingRateId: null,
      stitchingFlatMinor: null,
      packagingMinor: 0,
      shippingMinor: 0,
      overheadMinor: 0,
      aiCostMinor: 0,
      sellingPriceMinor: 500_000,
      ratesById,
    });

    expect(result.embroideryMinor).toBe(99_999);
  });

  it("margin percent is integer hundredths", () => {
    expect(computeMarginPercent(1_000_000, 700_000)).toBe(3000);
  });

  it("normalizes recurring costs to monthly", () => {
    expect(monthlyAmountMinor(12_000, "YEARLY")).toBe(1_000);
    expect(monthlyAmountMinor(3_000, "QUARTERLY")).toBe(1_000);
    expect(monthlyAmountMinor(1_000, "MONTHLY")).toBe(1_000);
  });
});
