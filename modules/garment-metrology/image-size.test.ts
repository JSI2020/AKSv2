import { describe, expect, it } from "vitest";

import { imageSizeFromBytes } from "./image-size";
import { ghostProportions, type GarmentLandmarks } from "./landmarks";

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(b.buffer);
  view.setUint32(8, 13); // IHDR length
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, a skippable APP0, then SOF0 carrying the dimensions.
  const b = new Uint8Array(24);
  const view = new DataView(b.buffer);
  b[0] = 0xff; b[1] = 0xd8; // SOI
  b[2] = 0xff; b[3] = 0xe0; // APP0
  view.setUint16(4, 4); // payload length (covers itself + 2 bytes)
  b[8] = 0xff; b[9] = 0xc0; // SOF0
  view.setUint16(10, 11);
  b[12] = 8; // precision
  view.setUint16(13, height);
  view.setUint16(15, width);
  return b;
}

describe("image dimensions from header bytes", () => {
  it("reads PNG", () => {
    expect(imageSizeFromBytes(png(1920, 2560))).toEqual({
      width: 1920,
      height: 2560,
    });
  });

  it("reads JPEG, skipping preceding segments", () => {
    expect(imageSizeFromBytes(jpeg(1080, 1440))).toEqual({
      width: 1080,
      height: 1440,
    });
  });

  it("returns null for unknown or truncated data", () => {
    expect(imageSizeFromBytes(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(imageSizeFromBytes(png(1920, 2560).slice(0, 10))).toBeNull();
  });
});

describe("ghost proportions respect the image aspect ratio", () => {
  const lm: GarmentLandmarks = {
    captureContext: "flat_lay",
    shoulderL: { x: 0.4, y: 0.1 },
    shoulderR: { x: 0.6, y: 0.1 },
    pitL: { x: 0.25, y: 0.2 },
    pitR: { x: 0.75, y: 0.2 },
    hemL: { x: 0.25, y: 0.9 },
    hemR: { x: 0.75, y: 0.9 },
  };

  it("computes chest and hem ratios against the shoulder-to-hem length", () => {
    // Square image: chest span 0.5×1000 = 500px, length 0.8×1000 = 800px.
    const p = ghostProportions(lm, 1000, 1000);
    expect(p.chestToLength).toBeCloseTo(500 / 800, 6);
    expect(p.hemToLength).toBeCloseTo(500 / 800, 6);
    expect(p.shoulderToLength).toBeCloseTo(200 / 800, 6);
  });

  it("a portrait frame stretches the vertical span, not the horizontal one", () => {
    // 1000×2000: chest still 500px, but length is 0.8×2000 = 1600px.
    const p = ghostProportions(lm, 1000, 2000);
    expect(p.chestToLength).toBeCloseTo(500 / 1600, 6);
  });
});
