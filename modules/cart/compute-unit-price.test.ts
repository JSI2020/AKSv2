import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();

vi.mock("@aks/db", () => ({
  db: {
    select: mockSelect,
  },
  designs: { id: "id", basePriceMinor: "base", madeToMeasureSurchargeMinor: "mtm", status: "status" },
  colourways: {
    id: "id",
    priceDeltaMinor: "delta",
    active: "active",
    designId: "designId",
  },
  customizationOptions: {
    id: "id",
    designId: "designId",
    key: "key",
    inputType: "inputType",
    required: "required",
  },
  customizationOptionValues: {
    optionId: "optionId",
    value: "value",
    priceDeltaMinor: "priceDeltaMinor",
  },
}));

function chain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where, limit });
  return { from, where, limit };
}

describe("computeCartLineUnitPrice", () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it("sums base, colourway delta, customization deltas, and MTM surcharge", async () => {
    const designChain = chain([
      {
        basePriceMinor: 100_000_00,
        madeToMeasureSurchargeMinor: 5_000_00,
        status: "PUBLISHED",
      },
    ]);
    const colourwayChain = chain([
      {
        priceDeltaMinor: 2_000_00,
        active: true,
        designId: "design-1",
      },
    ]);
    const optionsWhere = vi.fn().mockResolvedValue([
      {
        id: "opt-1",
        key: "lining",
        inputType: "SELECT",
        required: false,
      },
    ]);
    const optionsFrom = vi.fn().mockReturnValue({ where: optionsWhere });

    const valuesWhere = vi.fn().mockResolvedValue([
      {
        optionId: "opt-1",
        value: "silk",
        priceDeltaMinor: 1_500_00,
      },
    ]);
    const valuesFrom = vi.fn().mockReturnValue({ where: valuesWhere });

    mockSelect
      .mockReturnValueOnce(designChain)
      .mockReturnValueOnce(colourwayChain)
      .mockReturnValueOnce({ from: optionsFrom })
      .mockReturnValueOnce({ from: valuesFrom });

    const { computeCartLineUnitPrice } = await import("./compute-unit-price");

    const result = await computeCartLineUnitPrice({
      designId: "design-1",
      colourwayId: "cw-1",
      sizeMode: "MADE_TO_MEASURE",
      customizationSelections: { lining: "silk" },
    });

    expect(result).toEqual({
      basePriceMinor: 100_000_00,
      colourwayDeltaMinor: 2_000_00,
      customizationDeltaMinor: 1_500_00,
      madeToMeasureSurchargeMinor: 5_000_00,
      unitPriceMinor: 108_500_00,
    });
  });

  it("returns null when design is not published", async () => {
    mockSelect.mockReturnValueOnce(
      chain([
        {
          basePriceMinor: 1,
          madeToMeasureSurchargeMinor: 0,
          status: "DRAFT",
        },
      ]),
    );

    const { computeCartLineUnitPrice } = await import("./compute-unit-price");

    const result = await computeCartLineUnitPrice({
      designId: "design-1",
      colourwayId: "cw-1",
      sizeMode: "STANDARD",
      customizationSelections: {},
    });

    expect(result).toBeNull();
  });
});
