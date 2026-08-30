import { describe, expect, it } from "vitest";

import {
  computeGarmentFrame,
  computeGarmentOverlayLines,
} from "@/modules/sizing/garment-size-guide/garment-overlay-math";
import type { GarmentChartRow } from "@/modules/sizing/garment-size-guide/types";

const columnRows: GarmentChartRow[] = [
  {
    pomKey: "chest",
    measurementKey: "BUST",
    label: "Body block",
    values: { M: 4550, XS: 4150, S: 4350, L: 4750, XL: 4950, XXL: 5150 },
  },
  {
    pomKey: "shoulder",
    measurementKey: "SHOULDER",
    label: "Shoulder width",
    values: { M: 1600, XS: 1500, S: 1550, L: 1650, XL: 1700, XXL: 1750 },
  },
  {
    pomKey: "garmentLength",
    measurementKey: "LENGTH",
    label: "Length",
    values: { M: 5100, XS: 4900, S: 5000, L: 5200, XL: 5300, XXL: 5400 },
  },
  {
    pomKey: "hemWidth",
    measurementKey: "SWEEP",
    label: "Hem sweep",
    values: { M: 4550, XS: 4150, S: 4350, L: 4750, XL: 4950, XXL: 5150 },
  },
  {
    pomKey: "sleeveLength",
    measurementKey: "SLEEVE_LENGTH",
    label: "Sleeve",
    values: { M: 0, XS: 0, S: 0, L: 0, XL: 0, XXL: 0 },
  },
];

describe("computeGarmentFrame", () => {
  it("places hem from garment length", () => {
    const frame = computeGarmentFrame(1000, 5100);
    expect(frame.shoulderY).toBeLessThan(frame.hemY);
    expect(frame.hemY).toBeLessThan(980);
    expect(frame.hemY - frame.shoulderY).toBeGreaterThan(800);
  });
});

describe("computeGarmentOverlayLines", () => {
  it("length and hem share the same Y", () => {
    const lines = computeGarmentOverlayLines({
      rows: columnRows,
      sizeLabel: "M",
      imageWidthPx: 1024,
      imageHeightPx: 1024,
      silhouette: "column",
      formatValue: (v) => `${v / 100}`,
    });
    const length = lines.find((l) => l.pomKey === "garmentLength");
    const hem = lines.find((l) => l.pomKey === "hemWidth");
    expect(length?.yPx).toBe(hem?.anchorYPx);
  });

  it("omits sleeve when sleeveless", () => {
    const lines = computeGarmentOverlayLines({
      rows: columnRows,
      sizeLabel: "M",
      imageWidthPx: 1024,
      imageHeightPx: 1024,
      silhouette: "column",
      formatValue: (v) => `${v / 100}`,
    });
    expect(lines.some((l) => l.pomKey === "sleeveLength")).toBe(false);
  });

  it("shoulder line is narrower than body block", () => {
    const lines = computeGarmentOverlayLines({
      rows: columnRows,
      sizeLabel: "M",
      imageWidthPx: 1024,
      imageHeightPx: 1024,
      silhouette: "column",
      formatValue: (v) => `${v / 100}`,
    });
    const shoulder = lines.find((l) => l.pomKey === "shoulder");
    const chest = lines.find((l) => l.pomKey === "chest");
    expect(shoulder).toBeDefined();
    expect(chest).toBeDefined();
    const shoulderSpan = (shoulder!.x2 - shoulder!.x1);
    const chestSpan = chest!.x2 - chest!.x1;
    expect(shoulderSpan).toBeLessThan(chestSpan);
  });
});
