import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/packages/db/client";
import { dressGeneratedChart } from "@/packages/db/schema";
import { eq } from "drizzle-orm";

import { ensureDressSizingSeeded } from "../db/ensure";
import type { VisionAdapter } from "../recognition/adapter";
import { measureGarmentFromPhoto } from "./measure-garment";

/**
 * End-to-end wiring proof for the garment sizing engine.
 *
 * Drives the real pipeline — recognise → compose → detect landmarks → measure →
 * fuse → correct → reconcile — with an injected adapter and a pre-set imageUrl,
 * so nothing touches the network. What it asserts is exactly what a chart must
 * never get wrong: values on the quarter-inch grid, a column that stays one
 * circumference, and grading preserved across the shift.
 */

/** Minimal 1000×2000 PNG header — the engine reads dimensions from bytes. */
function pngFile(width: number, height: number): File {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(b.buffer);
  view.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([b], "garment.png", { type: "image/png" });
}

/** A floor-length column gown on a model, framed head-to-toe. */
const STYLE_JSON = JSON.stringify({
  templateKey: "long_gown",
  lengthBand: "floor",
  fitIntent: "relaxed",
  confidence: 0.95,
  points: {
    hem: { landmark: "floor", fullness: "regular" },
    neck: { shape: "round", drop: "regular" },
    sleeve: { style: "full" },
    chest: { fit: "relaxed" },
    waist: { fit: "relaxed" },
    hip: { fit: "relaxed" },
    shoulder: { width: "regular" },
  },
});

const LANDMARK_JSON = JSON.stringify({
  captureContext: "on_model",
  confidence: 90,
  shoulderL: [40, 18],
  shoulderR: [60, 18],
  pitL: [37, 26],
  pitR: [63, 26],
  hemL: [36, 92],
  hemR: [64, 92],
  neckTop: [50, 17],
  neckFront: [50, 21],
  cuffL: [33, 60],
  cuffR: [67, 60],
  personTop: [50, 4],
  personBottom: [50, 98],
});

function adapterFor(style: string, landmarks: string): VisionAdapter {
  return {
    async complete(_imageUrl, prompt) {
      // The landmark pass is the only one asking for capture context.
      return prompt.includes("captureContext") ? landmarks : style;
    },
  };
}

async function chartFor(styleId: string) {
  const rows = await db
    .select()
    .from(dressGeneratedChart)
    .where(eq(dressGeneratedChart.styleId, styleId));
  const byPom = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const bucket = byPom.get(r.pomKey) ?? {};
    bucket[r.size] = r.valueHundredths;
    byPom.set(r.pomKey, bucket);
  }
  return byPom;
}

describe("garment sizing engine — end-to-end wiring", () => {
  beforeAll(async () => {
    await ensureDressSizingSeeded(db);
  }, 60_000);

  it("measures the photo and writes a corrected chart", async () => {
    const result = await measureGarmentFromPhoto({
      image: pngFile(1000, 2000),
      imageUrl: "https://example.test/garment.png", // skips upload
      ghost: false, // skips generation
      adapter: adapterFor(STYLE_JSON, LANDMARK_JSON),
    });

    // The style pass ran.
    expect(result.templateKey).toBe("long_gown");
    expect(result.styleId).toBeTruthy();

    // The measurement pass ran — this is the whole point of the engine.
    expect(result.measurement).not.toBeNull();
    const m = result.measurement!;
    expect(m.landmarks.captureContext).toBe("on_model");
    expect(m.anchor).toBe("person_height"); // person in frame → height anchor
    expect(m.applied.length).toBeGreaterThan(0);

    const chart = await chartFor(result.styleId);

    // 1. Every value sits on the quarter-inch grid (no 43.59" artifacts).
    for (const [pom, bySize] of chart) {
      for (const [size, value] of Object.entries(bySize)) {
        expect(
          value % 25,
          `${pom}/${size} = ${value} is off the quarter-inch grid`,
        ).toBe(0);
      }
    }

    // 2. A column keeps ONE circumference after the photo correction.
    const chest = chart.get("chest")!;
    const waist = chart.get("waist")!;
    for (const size of Object.keys(chest)) {
      expect(waist[size], `chest vs waist diverged at ${size}`).toBe(
        chest[size],
      );
    }

    // 3. Every run grades EVENLY — the screenshot bug was neck coming out
    //    2.00 2.00 2.25 2.50 2.50 2.75 (steps 0, ¼, ¼, 0, ¼) because each cell
    //    was snapped on its own.
    const O = ["XS", "S", "M", "L", "XL", "XXL"];
    for (const [pom, bySize] of chart) {
      const vals = O.map((s) => bySize[s]).filter((v) => v != null) as number[];
      const steps = vals.slice(1).map((v, i) => v - vals[i]!);
      expect(
        new Set(steps).size,
        `${pom} grades unevenly: [${steps.map((x) => x / 100).join(", ")}]`,
      ).toBeLessThanOrEqual(1);
    }

    // 4. Grading survives the shift — sizes still ascend.
    const order = ["XS", "S", "M", "L", "XL", "XXL"];
    for (const [pom, bySize] of chart) {
      const values = order.map((s) => bySize[s]).filter((v) => v != null);
      for (let i = 1; i < values.length; i++) {
        expect(
          values[i]!,
          `${pom} decreases from ${order[i - 1]} to ${order[i]}`,
        ).toBeGreaterThanOrEqual(values[i - 1]!);
      }
    }
  }, 60_000);

  it("measures on the photo when no ghost is available", async () => {
    const result = await measureGarmentFromPhoto({
      image: pngFile(1000, 2000),
      imageUrl: "https://example.test/garment.png",
      ghost: false, // no ghost render at all
      adapter: adapterFor(STYLE_JSON, LANDMARK_JSON),
    });
    expect(result.ghostUrl).toBeNull();
    expect(result.measurement?.measuredOn).toBe("photo");
  }, 60_000);

  it("falls back to the template when landmarks are unusable", async () => {
    const result = await measureGarmentFromPhoto({
      image: pngFile(1000, 2000),
      imageUrl: "https://example.test/garment.png",
      ghost: false,
      // Hem above the pit — physically impossible, must be rejected.
      adapter: adapterFor(
        STYLE_JSON,
        JSON.stringify({
          captureContext: "flat_lay",
          shoulderL: [40, 18],
          shoulderR: [60, 18],
          pitL: [37, 60],
          pitR: [63, 60],
          hemL: [36, 30],
          hemR: [64, 30],
        }),
      ),
    });

    expect(result.measurement).toBeNull(); // template-only, nothing invented
    const chart = await chartFor(result.styleId);
    expect(chart.size).toBeGreaterThan(0); // but a usable chart still exists
  }, 60_000);

  it("survives a vision provider that returns garbage", async () => {
    const result = await measureGarmentFromPhoto({
      image: pngFile(1000, 2000),
      imageUrl: "https://example.test/garment.png",
      ghost: false,
      adapter: {
        async complete() {
          return "sorry, I cannot help with that";
        },
      },
    });

    // Recognition falls back to its default style; measurement is skipped.
    expect(result.measurement).toBeNull();
    expect(result.styleId).toBeTruthy();
  }, 60_000);
});
