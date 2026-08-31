import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIZE_BLOCK_SEEDS,
  flatToFinished,
  isTorsoLoop,
} from "@aks/shared";

describe("measurement basis", () => {
  it("doubles a torso loop that was captured flat", () => {
    for (const key of ["BUST", "CHEST", "WAIST", "HIP", "SWEEP", "DAMAN"]) {
      expect(isTorsoLoop(key), key).toBe(true);
      // 20.00" flat is a 40.00" finished loop.
      expect(flatToFinished(key, 2000, 2000)).toBe(4000);
    }
  });

  it("leaves a torso loop that is already a finished circumference", () => {
    // 38.00" is already a finished hip — doubling it would give 76".
    expect(flatToFinished("HIP", 3800, 3800)).toBe(3800);
    expect(flatToFinished("BUST", 3600, 3600)).toBe(3600);
  });

  it("leaves point-to-point spans alone", () => {
    for (const key of [
      "SHOULDER",
      "LENGTH",
      "BOTTOM_LENGTH",
      "SLEEVE_LENGTH",
      "NECK_DEPTH_FRONT",
      "CROSS_BACK",
      "BOTTOM_RISE",
    ]) {
      expect(isTorsoLoop(key), key).toBe(false);
      expect(flatToFinished(key, 2000, 2000)).toBe(2000);
    }
  });
});

describe("seeded house blocks are finished circumferences", () => {
  const kameez = DEFAULT_SIZE_BLOCK_SEEDS.find(
    (b) => b.categoryKey === "KAMEEZ",
  );

  it("converts the flat-captured research values", () => {
    expect(kameez).toBeDefined();
    const byKey = new Map(kameez!.rows.map((r) => [r.measurementKey, r]));
    // Captured flat at 20.00"; a finished kameez chest is 40.00".
    expect(byKey.get("BUST")?.baseValue).toBe(4000);
    expect(byKey.get("HIP")?.baseValue).toBe(4300);
    // Spans are untouched — shoulder point-to-point reads the same either way.
    expect(byKey.get("SHOULDER")?.baseValue).toBe(1450);
    expect(byKey.get("LENGTH")?.baseValue).toBe(3700);
  });

  it("scales the grade increments with the values", () => {
    const bust = kameez!.rows.find((r) => r.measurementKey === "BUST")!;
    // A flat grade of 1.65" per size is 3.30" of finished circumference.
    expect(bust.gradeIncrement).toBe(330);
    for (const step of Object.values(bust.gradeOverrides ?? {})) {
      expect(step % 2).toBe(0); // doubled, so still whole hundredths
    }
  });

  it("lands girths in a plausible finished range for real garments", () => {
    for (const block of DEFAULT_SIZE_BLOCK_SEEDS) {
      for (const row of block.rows) {
        if (!["BUST", "CHEST", "HIP"].includes(row.measurementKey)) continue;
        // Under 30" would be a child's garment; over 70" is not a house size.
        expect(
          row.baseValue,
          `${block.categoryKey}/${row.measurementKey} = ${row.baseValue / 100}"`,
        ).toBeGreaterThanOrEqual(3000);
        expect(row.baseValue).toBeLessThanOrEqual(7000);
      }
    }
  });
});
