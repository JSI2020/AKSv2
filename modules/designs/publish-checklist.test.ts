import { describe, expect, it } from "vitest";

import {
  evaluatePublishChecklist,
  hasEffectiveFabricConsumption,
  resolveEffectiveBasePriceMinor,
} from "./publish-checklist";

const baseDesign = {
  basePriceMinor: 500_000,
  fabricConsumptionMeters: 300,
  sizeBlockId: "block-1",
  fitProfileIds: { KAMEEZ: "fp-1" },
  components: ["KAMEEZ"],
};

const baseRenders = [
  { colourwayId: "cw-1", angle: "FRONT", altText: "Front view" },
];

const baseTags = [{ kind: "OCCASION", value: "EVERYDAY" }];

describe("evaluatePublishChecklist", () => {
  it("blocks publish when size block has no rows", () => {
    const missing = evaluatePublishChecklist({
      design: baseDesign,
      colourways: [{ id: "cw-1", name: "Ivory" }],
      renders: baseRenders,
      tags: baseTags,
      sizeBlockRowCount: 0,
    });
    expect(missing.some((m) => m.includes("measurement rows"))).toBe(true);
  });

  it("passes when size block has rows", () => {
    const missing = evaluatePublishChecklist({
      design: baseDesign,
      colourways: [{ id: "cw-1", name: "Ivory" }],
      renders: baseRenders,
      tags: baseTags,
      sizeBlockRowCount: 3,
    });
    expect(missing).toEqual([]);
  });

  it("accepts base price on a shade when design row is zero", () => {
    expect(
      resolveEffectiveBasePriceMinor(
        { basePriceMinor: 0 },
        [{ basePriceMinor: 1_250_000 }],
      ),
    ).toBe(1_250_000);

    const missing = evaluatePublishChecklist({
      design: { ...baseDesign, basePriceMinor: 0 },
      colourways: [
        {
          id: "cw-1",
          name: "Ivory",
          basePriceMinor: 1_250_000,
          costingSnapshot: {
            fabricId: "fab-1",
            fabricMeters: 250,
            packagingMinor: 0,
            shippingMinor: 0,
            overheadMinor: 0,
            costingMode: "DETAILED_PER_PIECE",
            pieceCosts: [
              {
                componentKey: "KAMEEZ",
                mode: "DETAILED",
                fabricId: "fab-1",
                fabricMeters: 250,
              },
            ],
            totalLumpsumMinor: null,
            totalCostMinor: 0,
            marginPercent: 0,
            sellingPriceMinor: 1_250_000,
          },
        },
      ],
      renders: baseRenders,
      tags: baseTags,
      sizeBlockRowCount: 3,
    });
    expect(missing).toEqual([]);
  });

  it("blocks when fit profile and occasion tag are missing", () => {
    const missing = evaluatePublishChecklist({
      design: { ...baseDesign, fitProfileIds: {} },
      colourways: [{ id: "cw-1", name: "Ivory" }],
      renders: baseRenders,
      tags: [],
      sizeBlockRowCount: 3,
    });
    expect(missing).toContain("fit profile");
    expect(missing).toContain("occasion tag");
  });

  it("accepts shade costing snapshot for fabric consumption", () => {
    expect(
      hasEffectiveFabricConsumption(
        { fabricConsumptionMeters: 0 },
        [
          {
            costingSnapshot: {
              fabricId: "fab-1",
              fabricMeters: 250,
              packagingMinor: 0,
              shippingMinor: 0,
              overheadMinor: 0,
              costingMode: "DETAILED_PER_PIECE",
              pieceCosts: [],
              totalLumpsumMinor: null,
              totalCostMinor: 0,
              marginPercent: 0,
              sellingPriceMinor: 0,
            },
          },
        ],
      ),
    ).toBe(true);
  });
});
