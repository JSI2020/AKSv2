import { describe, expect, it } from "vitest";

import { bodyGridFromRows, composeChart } from "./compose";
import { instantiateStyle } from "./instantiate";
import { aksStandardV1RowsHundredths } from "./body-grid";
import { STYLE_TEMPLATE_SEEDS } from "../db/template-seeds";
import {
  girthKeysEqualAtM,
  reconcileSilhouette,
  resolveSilhouette,
} from "./silhouette";
import type { GeneratedRow } from "./types";

function template(key: (typeof STYLE_TEMPLATE_SEEDS)[number]["key"]) {
  const seed = STYLE_TEMPLATE_SEEDS.find((s) => s.key === key);
  if (!seed) throw new Error(`missing template ${key}`);
  return seed;
}

function mValue(rows: GeneratedRow[], pomKey: GeneratedRow["pomKey"]) {
  return rows.find((r) => r.size === "M" && r.pomKey === pomKey)?.valueHundredths;
}

describe("resolveSilhouette", () => {
  it("treats relaxed long gown as column", () => {
    expect(
      resolveSilhouette({
        templateKey: "long_gown",
        fitIntent: "relaxed",
      }),
    ).toBe("column");
  });

  it("treats semi-fitted kurti as waisted", () => {
    expect(
      resolveSilhouette({
        templateKey: "kurti",
        fitIntent: "semi_fitted",
      }),
    ).toBe("waisted");
  });

  it("treats flared hem as a_line", () => {
    expect(
      resolveSilhouette({
        templateKey: "kurti",
        fitIntent: "semi_fitted",
        points: { hem: { fullness: "flared" } },
      }),
    ).toBe("a_line");
  });
});

describe("composeChart + reconcileSilhouette", () => {
  const grid = bodyGridFromRows(aksStandardV1RowsHundredths());

  it("column cut equalizes chest and waist at M", () => {
    const inst = instantiateStyle(template("long_gown"), {
      lengthBand: "floor",
      fitIntent: "relaxed",
    });
    const rows = composeChart(grid, inst, inst);
    expect(girthKeysEqualAtM(rows)).toBe(true);
    expect(mValue(rows, "chest")).toBe(4350);
    expect(mValue(rows, "waist")).toBe(4350);
  });

  it("column cut never allows hem narrower than body block", () => {
    const inst = instantiateStyle(template("long_gown"), {
      lengthBand: "floor",
      fitIntent: "relaxed",
      points: { hem: { fullness: "regular" } },
    });
    const rows = composeChart(grid, inst, inst);
    const block = mValue(rows, "chest")!;
    const hem = mValue(rows, "hemWidth")!;
    expect(hem).toBeGreaterThanOrEqual(block);
  });

  it("a-line adds flare above body block at hem", () => {
    const inst = instantiateStyle(template("long_gown"), {
      lengthBand: "floor",
      fitIntent: "relaxed",
      points: { hem: { fullness: "flared" } },
    });
    const rows = composeChart(grid, inst, inst);
    const block = mValue(rows, "chest")!;
    const hem = mValue(rows, "hemWidth")!;
    expect(hem).toBe(block + 400);
  });

  it("waisted kurti keeps bust/waist separation at M", () => {
    const inst = instantiateStyle(template("kurti"), {
      lengthBand: "knee",
      fitIntent: "semi_fitted",
    });
    const rows = composeChart(grid, inst, inst);
    expect(girthKeysEqualAtM(rows)).toBe(false);
    expect(mValue(rows, "chest")).toBe(4050);
    expect(mValue(rows, "waist")).toBe(3250);
  });

  it("sleeveless styles never grade below zero", () => {
    const inst = instantiateStyle(template("kurti"), {
      lengthBand: "knee",
      fitIntent: "semi_fitted",
      points: { sleeve: { style: "sleeveless" } },
    });
    const rows = composeChart(grid, inst, inst);
    for (const size of ["XS", "S", "M", "L", "XL", "XXL"] as const) {
      const sleeve = rows.find(
        (r) => r.size === size && r.pomKey === "sleeveLength",
      )?.valueHundredths;
      expect(sleeve).toBeGreaterThanOrEqual(0);
    }
    expect(mValue(rows, "sleeveLength")).toBe(0);
  });
});

describe("reconcileSilhouette hem guard", () => {
  it("raises hem to body block when template undershoots", () => {
    const rows: GeneratedRow[] = [
      { size: "M", pomKey: "chest", valueHundredths: 4350 },
      { size: "M", pomKey: "waist", valueHundredths: 4350 },
      { size: "M", pomKey: "hemWidth", valueHundredths: 3200 },
    ];
    const next = reconcileSilhouette(rows, {
      silhouette: "column",
      hemFullness: "regular",
      templateKey: "long_gown",
    });
    expect(mValue(next, "hemWidth")).toBe(4350);
  });
});
