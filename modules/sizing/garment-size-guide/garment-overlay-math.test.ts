import { describe, expect, it } from "vitest";

import { computeGarmentOverlayLines } from "./garment-overlay-math";
import type { GarmentChartRow } from "./types";

const W = 1000;
const H = 1400;

function row(
  pomKey: string,
  label: string,
  m: number,
): GarmentChartRow {
  return {
    pomKey,
    measurementKey: pomKey.toUpperCase(),
    label,
    values: { M: m },
  } as GarmentChartRow;
}

/** A waisted kameez: chest 40.5", waist 32.5", sleeve 22", length 38". */
const ROWS: GarmentChartRow[] = [
  row("chest", "Chest", 4050),
  row("waist", "Waist", 3250),
  row("hip", "Hip", 4150),
  row("shoulder", "Shoulder width", 1550),
  row("sleeveLength", "Sleeve", 2200),
  row("garmentLength", "Length", 3800),
  row("hemWidth", "Hem sweep", 4150),
  row("neckDrop", "Neck depth", 300),
];

function lines() {
  return computeGarmentOverlayLines({
    rows: ROWS,
    sizeLabel: "M",
    imageWidthPx: W,
    imageHeightPx: H,
    silhouette: "waisted",
    formatValue: (v) => `${(v / 100).toFixed(2)}"`,
  });
}

describe("garment overlay geometry", () => {
  it("draws the sleeve along the sleeve, not down through the body", () => {
    const sleeve = lines().find((l) => l.pomKey === "sleeveLength")!;
    expect(sleeve.kind).toBe("diagonal");
    // It leans outward as it descends — a vertical line would fail both.
    expect(sleeve.x2).toBeGreaterThan(sleeve.x1);
    expect(sleeve.yPx).toBeGreaterThan(sleeve.anchorYPx);
  });

  it("starts the sleeve at the shoulder point, not the centre", () => {
    const all = lines();
    const sleeve = all.find((l) => l.pomKey === "sleeveLength")!;
    const shoulder = all.find((l) => l.pomKey === "shoulder")!;
    // The shoulder POINT is the outer end of the shoulder span.
    expect(sleeve.x1).toBe(Math.round(shoulder.x2));
    expect(sleeve.anchorYPx).toBe(shoulder.anchorYPx);
    // Well clear of the body centre line.
    expect(sleeve.x1).toBeGreaterThan(W * 0.55);
  });

  it("keeps the sleeve inside the frame and above the hem", () => {
    const all = lines();
    const sleeve = all.find((l) => l.pomKey === "sleeveLength")!;
    const hem = all.find((l) => l.pomKey === "hemWidth")!;
    expect(sleeve.x2).toBeLessThanOrEqual(W);
    expect(sleeve.yPx).toBeLessThanOrEqual(hem.anchorYPx);
  });

  it("keeps girth and width lines horizontal", () => {
    for (const line of lines()) {
      if (line.kind === "girth" || line.kind === "width") {
        expect(line.anchorYPx, line.pomKey).toBe(line.yPx);
      }
    }
  });

  it("orders the body lines shoulder → chest → waist → hip → hem", () => {
    const all = lines();
    const y = (k: string) => all.find((l) => l.pomKey === k)?.anchorYPx ?? 0;
    expect(y("shoulder")).toBeLessThan(y("chest"));
    expect(y("chest")).toBeLessThan(y("waist"));
    expect(y("waist")).toBeLessThanOrEqual(y("hip"));
    expect(y("hip")).toBeLessThan(y("hemWidth"));
  });

  it("separates the length line from the hem sweep it ends on", () => {
    const all = lines();
    const length = all.find((l) => l.pomKey === "garmentLength")!;
    const hem = all.find((l) => l.pomKey === "hemWidth")!;
    expect(length.kind).toBe("vertical");
    // Both terminate at the hemline, so they must not share an x position.
    expect(Math.abs(length.x1 - hem.x2)).toBeGreaterThan(W / 40);
  });

  it("scales the sleeve line with the measurement", () => {
    const short = computeGarmentOverlayLines({
      rows: ROWS.map((r) =>
        r.pomKey === "sleeveLength" ? row("sleeveLength", "Sleeve", 900) : r,
      ),
      sizeLabel: "M",
      imageWidthPx: W,
      imageHeightPx: H,
      silhouette: "waisted",
      formatValue: (v) => `${v}`,
    }).find((l) => l.pomKey === "sleeveLength")!;
    const long = lines().find((l) => l.pomKey === "sleeveLength")!;
    expect(long.yPx).toBeGreaterThan(short.yPx);
  });

  it("omits the sleeve entirely when the garment is sleeveless", () => {
    const out = computeGarmentOverlayLines({
      rows: ROWS.map((r) =>
        r.pomKey === "sleeveLength" ? row("sleeveLength", "Sleeve", 0) : r,
      ),
      sizeLabel: "M",
      imageWidthPx: W,
      imageHeightPx: H,
      silhouette: "waisted",
      formatValue: (v) => `${v}`,
    });
    expect(out.find((l) => l.pomKey === "sleeveLength")).toBeUndefined();
  });
});
