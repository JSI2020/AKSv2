import { describe, expect, it } from "vitest";

import { resolveChart, resolveChartRaw } from "./resolve-chart";
import { applyChartPolicy, policyFor, validateChartAnatomy } from "./chart-policy";
import type { SizeBlockInput, SizeBlockRowInput } from "./types";

const BLOCK: SizeBlockInput = {
  sizeLabels: ["XS", "S", "M", "L", "XL", "XXL"],
  baseSizeLabel: "M",
};

function values(grid: ReturnType<typeof resolveChart>, key: string) {
  return BLOCK.sizeLabels.map((s) => grid[key]![s]!.value);
}

describe("chart policy — the physical law every chart obeys", () => {
  it("regression: sleeveless base 0 with a leftover seeded grade never goes negative (the −0.5″ screenshot bug)", () => {
    // AI wrote base 0 onto a row that kept gradeIncrement 25 (0.25″/size).
    const rows: SizeBlockRowInput[] = [
      { measurementKey: "SLEEVE_LENGTH", baseValue: 0, gradeIncrement: 25 },
    ];
    const raw = resolveChartRaw(BLOCK, rows);
    // The raw arithmetic really does produce the impossible chart…
    expect(values(raw, "SLEEVE_LENGTH")).toEqual([-50, -25, 0, 25, 50, 75]);
    // …and the policy holds the whole row flat at 0.
    const guarded = resolveChart(BLOCK, rows);
    expect(values(guarded, "SLEEVE_LENGTH")).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("neck depth never grades below its wearable floor (the 0.75″ XS screenshot bug)", () => {
    const rows: SizeBlockRowInput[] = [
      { measurementKey: "NECK_DEPTH_FRONT", baseValue: 100, gradeIncrement: 15 },
    ];
    const guarded = resolveChart(BLOCK, rows);
    for (const v of values(guarded, "NECK_DEPTH_FRONT")) {
      expect(v).toBeGreaterThanOrEqual(75);
    }
  });

  it("pinned cells cannot break physics: an irregular pin below a smaller size is repaired monotonic", () => {
    const rows: SizeBlockRowInput[] = [
      { measurementKey: "BUST", baseValue: 3650, gradeIncrement: 200 },
    ];
    const guarded = resolveChart(BLOCK, rows, [
      // A snapped pin that dips below L (like the 1.25 → 1.25 neck plateau).
      { measurementKey: "BUST", sizeLabel: "XL", value: 3800 },
    ]);
    const vals = values(guarded, "BUST");
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]!).toBeGreaterThanOrEqual(vals[i - 1]!);
    }
  });

  it("downward sizes may never exceed the base side", () => {
    const rows: SizeBlockRowInput[] = [
      { measurementKey: "HIP", baseValue: 3850, gradeIncrement: 200 },
    ];
    const guarded = resolveChart(BLOCK, rows, [
      { measurementKey: "HIP", sizeLabel: "XS", value: 5000 },
    ]);
    const vals = values(guarded, "HIP");
    expect(vals[0]!).toBeLessThanOrEqual(vals[1]!);
  });

  it("a real sleeve with a positive base still grades normally", () => {
    const rows: SizeBlockRowInput[] = [
      { measurementKey: "SLEEVE_LENGTH", baseValue: 2200, gradeIncrement: 25 },
    ];
    const guarded = resolveChart(BLOCK, rows);
    expect(values(guarded, "SLEEVE_LENGTH")).toEqual([
      2150, 2175, 2200, 2225, 2250, 2275,
    ]);
  });

  it("repairs are reported, not silent", () => {
    const rows: SizeBlockRowInput[] = [
      { measurementKey: "SLEEVE_LENGTH", baseValue: 0, gradeIncrement: 25 },
    ];
    const raw = resolveChartRaw(BLOCK, rows);
    const { repairs } = applyChartPolicy(BLOCK, rows, raw);
    expect(repairs.length).toBeGreaterThan(0);
    expect(repairs.every((r) => r.rule === "flat-zero")).toBe(true);
  });

  it("anatomy warnings: a 1″/size length grade is flagged, a ⅜″ one is not", () => {
    const steep: SizeBlockRowInput[] = [
      { measurementKey: "LENGTH", baseValue: 5100, gradeIncrement: 100 },
    ];
    const sane: SizeBlockRowInput[] = [
      { measurementKey: "LENGTH", baseValue: 5100, gradeIncrement: 38 },
    ];
    expect(
      validateChartAnatomy(BLOCK, resolveChart(BLOCK, steep)).length,
    ).toBeGreaterThan(0);
    expect(validateChartAnatomy(BLOCK, resolveChart(BLOCK, sane))).toEqual([]);
  });

  it("anatomy warnings: waist above bust is flagged", () => {
    const rows: SizeBlockRowInput[] = [
      { measurementKey: "BUST", baseValue: 3650, gradeIncrement: 200 },
      { measurementKey: "WAIST", baseValue: 4000, gradeIncrement: 200 },
    ];
    const warnings = validateChartAnatomy(BLOCK, resolveChart(BLOCK, rows));
    expect(warnings.some((w) => w.measurementKey === "WAIST")).toBe(true);
  });

  it("policy lookup matches by prefix", () => {
    expect(policyFor("SLEEVE_LENGTH").flatWhenBaseZero).toBe(true);
    expect(policyFor("NECK_DEPTH_FRONT").min).toBe(75);
    expect(policyFor("BUST").monotonicNonDecreasing).toBe(true);
  });
});
