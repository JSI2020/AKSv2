import { describe, expect, it } from "vitest";

import {
  editBaseCell,
  resolveCellValue,
  resolveChart,
  SizingEngineError,
  type SizeBlockInput,
  type SizeBlockRowInput,
} from "./index";

const LABELS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const block: SizeBlockInput = {
  sizeLabels: LABELS,
  baseSizeLabel: "M",
};

function inches(n: number): number {
  return Math.round(n * 100);
}

function valuesFor(
  grid: ReturnType<typeof resolveChart>,
  key: string,
): number[] {
  const row = grid[key];
  if (!row) throw new Error(`missing row ${key}`);
  return LABELS.map((label) => {
    const cell = row[label];
    if (!cell) throw new Error(`missing cell ${key}/${label}`);
    return cell.value;
  });
}

describe("resolveChart", () => {
  it("uniform increments", () => {
    const rows: SizeBlockRowInput[] = [
      {
        measurementKey: "LENGTH",
        baseValue: inches(30),
        gradeIncrement: inches(1),
      },
    ];
    const grid = resolveChart(block, rows);
    expect(valuesFor(grid, "LENGTH")).toEqual(
      [28, 29, 30, 31, 32, 33].map(inches),
    );
  });

  it("per-step overrides producing non-linear grading", () => {
    const rows: SizeBlockRowInput[] = [
      {
        measurementKey: "BUST",
        baseValue: inches(36),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
      },
    ];
    const grid = resolveChart(block, rows);
    // Override at XL affects only L→XL; XXL only XL→XXL
    expect(valuesFor(grid, "BUST")).toEqual(
      [32, 34, 36, 38, 41, 44].map(inches),
    );
  });

  it("pinned cells excluded from recomputation", () => {
    const rows: SizeBlockRowInput[] = [
      {
        measurementKey: "LENGTH",
        baseValue: inches(30),
        gradeIncrement: inches(1),
      },
    ];
    const pinned = [
      {
        measurementKey: "LENGTH",
        sizeLabel: "XXL",
        value: inches(31),
      },
    ];
    const before = resolveChart(block, rows, pinned);
    expect(before.LENGTH?.XXL).toEqual({ value: inches(31), pinned: true });
    expect(before.LENGTH?.XL).toEqual({ value: inches(32), pinned: false });

    const edited = rows.map((r) => editBaseCell(r, inches(27)));
    const after = resolveChart(block, edited, pinned);
    expect(valuesFor(after, "LENGTH")).toEqual(
      [25, 26, 27, 28, 29, 31].map(inches),
    );
    expect(after.LENGTH?.XXL?.pinned).toBe(true);
  });

  it("throws when baseSizeLabel is missing", () => {
    expect(() =>
      resolveCellValue(
        { sizeLabels: LABELS, baseSizeLabel: "MD" },
        { measurementKey: "L", baseValue: 100, gradeIncrement: 10 },
        "M",
      ),
    ).toThrow(SizingEngineError);
  });

  it("throws when sizeLabel is missing", () => {
    expect(() =>
      resolveCellValue(block, {
        measurementKey: "L",
        baseValue: 100,
        gradeIncrement: 10,
      }, "XXXL"),
    ).toThrow(/sizeLabel/);
  });
});

describe("editBaseCell", () => {
  it("delta propagation preserving increments", () => {
    const row: SizeBlockRowInput = {
      measurementKey: "LENGTH",
      baseValue: inches(30),
      gradeIncrement: inches(1),
    };
    const edited = editBaseCell(row, inches(27));
    expect(edited.baseValue).toBe(inches(27));
    expect(edited.gradeIncrement).toBe(inches(1));

    const grid = resolveChart(block, [edited]);
    expect(valuesFor(grid, "LENGTH")).toEqual(
      [25, 26, 27, 28, 29, 30].map(inches),
    );
  });

  it("does_not_scale_proportionally", () => {
    const row: SizeBlockRowInput = {
      measurementKey: "LENGTH",
      baseValue: inches(30),
      gradeIncrement: inches(1),
    };
    const edited = editBaseCell(row, inches(27));
    const grid = resolveChart(block, [edited]);
    const got = valuesFor(grid, "LENGTH");

    // Correct: delta shift
    expect(got).toEqual([25, 26, 27, 28, 29, 30].map(inches));

    // Wrong algorithm: proportional scale by 27/30
    const original = [28, 29, 30, 31, 32, 33].map(inches);
    const proportional = original.map((v) => Math.round((v * 27) / 30));
    expect(proportional).toEqual(
      [25.2, 26.1, 27, 27.9, 28.8, 29.7].map((n) => Math.round(n * 100)),
    );
    expect(got).not.toEqual(proportional);
  });
});

describe("property: non-pinned cell always equals base + Σ(increments)", () => {
  it("holds for any valid block", () => {
    const increments = [25, 50, 100, 200];
    const bases = [1000, 2200, 3600, 5200];

    for (let trial = 0; trial < 40; trial++) {
      const gradeIncrement = increments[trial % increments.length]!;
      const baseValue = bases[trial % bases.length]!;
      const overrideXl = trial % 3 === 0 ? gradeIncrement + 50 : undefined;
      const row: SizeBlockRowInput = {
        measurementKey: "M",
        baseValue,
        gradeIncrement,
        gradeOverrides:
          overrideXl !== undefined ? { XL: overrideXl } : undefined,
      };
      const pinIdx = trial % 7;
      const pinned =
        pinIdx < LABELS.length
          ? [
              {
                measurementKey: "M",
                sizeLabel: LABELS[pinIdx]!,
                value: baseValue + 999,
              },
            ]
          : [];

      const grid = resolveChart(block, [row], pinned);
      const rowGrid = grid.M!;
      for (const label of LABELS) {
        const cell = rowGrid[label]!;
        if (cell.pinned) {
          expect(cell.value).toBe(baseValue + 999);
          continue;
        }
        const expected = resolveCellValue(block, row, label);
        expect(cell.value).toBe(expected);

        // Independent Σ(increments) from base
        const baseIdx = LABELS.indexOf("M");
        const targetIdx = LABELS.indexOf(label);
        const steps = targetIdx - baseIdx;
        let sum = baseValue;
        const dir = Math.sign(steps);
        for (let i = 1; i <= Math.abs(steps); i++) {
          const stepLabel = LABELS[baseIdx + i * dir]!;
          const step =
            row.gradeOverrides?.[stepLabel] ?? row.gradeIncrement;
          sum += step * dir;
        }
        expect(cell.value).toBe(sum);
      }
    }
  });
});
