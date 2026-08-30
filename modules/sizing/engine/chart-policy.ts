/**
 * Chart policy — the single physical/anatomical law for every resolved size
 * chart. Pure functions, no I/O. Values = integer hundredths of an inch.
 *
 * Why this exists: charts are produced by two engines (the dress-sizing
 * composer and the house-block `resolveChart`) plus an AI mapping that writes
 * bases and pins. Guards that live in only one of those paths leak through the
 * others (negative sleeve lengths, sub-floor neck depths, non-monotonic rows).
 * Every read path goes through `resolveChart`, so the policy is applied there —
 * one law, everywhere.
 */

import type { ChartGrid, SizeBlockInput, SizeBlockRowInput } from "./types";

export type MeasurementPolicy = {
  /** Hard lower bound for any cell (hundredths of an inch). */
  min: number;
  /**
   * Larger sizes may never be smaller than smaller sizes. True for every
   * body-derived measure (girths, lengths, widths) on a graded chart.
   */
  monotonicNonDecreasing: boolean;
  /**
   * A base of exactly 0 means the feature does not exist on this garment
   * (sleeveless ⇒ sleeve length 0) — the whole row is held flat at 0 instead
   * of grading into negative or phantom values.
   */
  flatWhenBaseZero: boolean;
};

const DEFAULT_POLICY: MeasurementPolicy = {
  min: 0,
  monotonicNonDecreasing: true,
  flatWhenBaseZero: false,
};

/** Prefix-matched policies; first match wins. */
const POLICIES: Array<{ pattern: RegExp; policy: MeasurementPolicy }> = [
  {
    // Sleeves and armhole-adjacent lengths can be absent (sleeveless / cap).
    pattern: /^SLEEVE/,
    policy: { min: 0, monotonicNonDecreasing: true, flatWhenBaseZero: true },
  },
  {
    // A closed neckline still needs a wearable front drop (~3/4" to pass over
    // the head with the placket/collar); grading may never dip below it.
    pattern: /^NECK_DEPTH/,
    policy: { min: 75, monotonicNonDecreasing: true, flatWhenBaseZero: true },
  },
  {
    // Girths and sweeps: physically positive, grow with size.
    pattern: /^(BUST|CHEST|WAIST|UPPER_WAIST|LOWER_WAIST|HIP|SWEEP|HEM|BOTTOM_OPENING|THIGH|KNEE|ARMHOLE)/,
    policy: { min: 0, monotonicNonDecreasing: true, flatWhenBaseZero: false },
  },
];

export function policyFor(measurementKey: string): MeasurementPolicy {
  for (const { pattern, policy } of POLICIES) {
    if (pattern.test(measurementKey)) return policy;
  }
  return DEFAULT_POLICY;
}

export type ChartRepair = {
  measurementKey: string;
  sizeLabel: string;
  from: number;
  to: number;
  rule: "flat-zero" | "min-floor" | "monotonic";
};

/**
 * Enforce the policy on a resolved grid, in place-order:
 *  1. flat-zero rows (base 0 on an optional feature ⇒ every size 0),
 *  2. hard minimum floors,
 *  3. monotonic repair walking outward from the base size (upward sizes may
 *     never shrink; downward sizes may never exceed the base-side neighbour).
 * Pinned cells are corrected too — a pin may not break physics.
 */
export function applyChartPolicy(
  block: SizeBlockInput,
  rows: readonly SizeBlockRowInput[],
  grid: ChartGrid,
): { grid: ChartGrid; repairs: ChartRepair[] } {
  const repairs: ChartRepair[] = [];
  const labels = block.sizeLabels;
  const baseIdx = labels.indexOf(block.baseSizeLabel);
  const rowByKey = new Map(rows.map((r) => [r.measurementKey, r]));

  for (const [measurementKey, rowGrid] of Object.entries(grid)) {
    const policy = policyFor(measurementKey);
    const row = rowByKey.get(measurementKey);
    const baseCell = rowGrid[block.baseSizeLabel];

    const repair = (
      sizeLabel: string,
      to: number,
      rule: ChartRepair["rule"],
    ) => {
      const cell = rowGrid[sizeLabel];
      if (!cell || cell.value === to) return;
      repairs.push({ measurementKey, sizeLabel, from: cell.value, to, rule });
      rowGrid[sizeLabel] = { ...cell, value: to };
    };

    // 1. Absent feature: base 0 (or an all-zero intent on the row) holds flat.
    const baseIsZero =
      (baseCell ? baseCell.value === 0 : false) ||
      (row ? row.baseValue === 0 && policy.flatWhenBaseZero : false);
    if (policy.flatWhenBaseZero && baseIsZero) {
      for (const label of labels) repair(label, 0, "flat-zero");
      continue;
    }

    // 2. Hard floors.
    for (const label of labels) {
      const cell = rowGrid[label];
      if (cell && cell.value < policy.min) repair(label, policy.min, "min-floor");
    }

    // 3. Monotonic non-decreasing, repaired outward from the base size.
    if (policy.monotonicNonDecreasing && baseIdx >= 0) {
      for (let i = baseIdx + 1; i < labels.length; i++) {
        const prev = rowGrid[labels[i - 1]!];
        const cell = rowGrid[labels[i]!];
        if (prev && cell && cell.value < prev.value) {
          repair(labels[i]!, prev.value, "monotonic");
        }
      }
      for (let i = baseIdx - 1; i >= 0; i--) {
        const next = rowGrid[labels[i + 1]!];
        const cell = rowGrid[labels[i]!];
        if (next && cell && cell.value > next.value) {
          repair(labels[i]!, next.value, "monotonic");
        }
      }
    }
  }

  return { grid, repairs };
}

export type ChartWarning = { measurementKey: string; message: string };

/** Steps larger than these read as data errors, not grading (hundredths/size). */
const MAX_SANE_STEP: Array<{ pattern: RegExp; step: number; label: string }> = [
  { pattern: /^LENGTH|^SLEEVE/, step: 50, label: "1/2″" },
  { pattern: /^SHOULDER/, step: 38, label: "3/8″" },
  { pattern: /^NECK_DEPTH/, step: 25, label: "1/4″" },
];

/**
 * Anatomical sanity warnings — advisory only, never mutate. Surfaced so a
 * human can catch a chart that is technically valid but physically unlikely.
 */
export function validateChartAnatomy(
  block: SizeBlockInput,
  grid: ChartGrid,
): ChartWarning[] {
  const warnings: ChartWarning[] = [];
  const labels = block.sizeLabels;

  for (const [measurementKey, rowGrid] of Object.entries(grid)) {
    const rule = MAX_SANE_STEP.find((r) => r.pattern.test(measurementKey));
    if (!rule) continue;
    for (let i = 1; i < labels.length; i++) {
      const a = rowGrid[labels[i - 1]!];
      const b = rowGrid[labels[i]!];
      if (a && b && Math.abs(b.value - a.value) > rule.step) {
        warnings.push({
          measurementKey,
          message: `${measurementKey} grades ${((b.value - a.value) / 100).toFixed(2)}″ between ${labels[i - 1]} and ${labels[i]} — more than ${rule.label} per size reads as a girth-style grade applied to a length.`,
        });
        break;
      }
    }
  }

  // A waisted chart where waist exceeds bust is inside-out.
  const bust = grid["BUST"] ?? grid["CHEST"];
  const waist = grid["WAIST"];
  if (bust && waist) {
    for (const label of labels) {
      const b = bust[label];
      const w = waist[label];
      if (b && w && w.value > b.value) {
        warnings.push({
          measurementKey: "WAIST",
          message: `Waist (${(w.value / 100).toFixed(1)}″) exceeds bust (${(b.value / 100).toFixed(1)}″) at ${label} — only valid for a column cut; check the silhouette.`,
        });
        break;
      }
    }
  }

  return warnings;
}
