import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  MODEL_HEIGHT_FALLBACK_FRACTION_BP,
  detectModelPixelHeight,
  pixelsPerInch,
} from "./detect-model-height";
import {
  computeOverlayLines,
  defaultAnchorYBp,
  overlayDirection,
} from "./overlay-math";

describe("detectModelPixelHeight", () => {
  it("uses stored height when provided", async () => {
    const buf = await sharp({
      create: {
        width: 400,
        height: 800,
        channels: 3,
        background: { r: 220, g: 218, b: 210 },
      },
    })
      .png()
      .toBuffer();

    const result = await detectModelPixelHeight(buf, 720);
    expect(result.modelPixelHeight).toBe(720);
    expect(result.modelHeightDetection).toBe("stored");
    expect(result.imageHeightPx).toBe(800);
  });

  it("documents fallback as 88% of frame height", () => {
    expect(MODEL_HEIGHT_FALLBACK_FRACTION_BP).toBe(8800);
    const h = 1000;
    expect(Math.round((h * MODEL_HEIGHT_FALLBACK_FRACTION_BP) / 10_000)).toBe(
      880,
    );
  });
});

describe("pixelsPerInch", () => {
  it("converts hundredths-of-inch archetype height correctly", () => {
    // 67 inches = 6700 hundredths, model 804px tall → 12 px/in
    expect(pixelsPerInch(804, 6700)).toBeCloseTo(12, 5);
  });
});

describe("computeOverlayLines", () => {
  it("moves LENGTH line down when value increases", () => {
    const base = computeOverlayLines({
      imageHeightPx: 1000,
      modelPixelHeight: 880,
      archetypeHeightInches: 6700,
      anchorYBpByKey: { LENGTH: defaultAnchorYBp("LENGTH") },
      valuesByKey: { LENGTH: 4500 },
      formatValue: (v) => `${v / 100}″`,
    });
    const longer = computeOverlayLines({
      imageHeightPx: 1000,
      modelPixelHeight: 880,
      archetypeHeightInches: 6700,
      anchorYBpByKey: { LENGTH: defaultAnchorYBp("LENGTH") },
      valuesByKey: { LENGTH: 4800 },
      formatValue: (v) => `${v / 100}″`,
    });

    expect(base[0]?.measurementKey).toBe("LENGTH");
    expect(overlayDirection("LENGTH")).toBe("down");
    expect(longer[0]!.yPx).toBeGreaterThan(base[0]!.yPx);
  });
});
