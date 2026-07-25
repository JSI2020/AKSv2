/**
 * Replaceable placeholder size-block numbers (×100 = hundredths of an inch).
 * Designer will replace these with real pattern-block values before production.
 */

export const STANDARD_SIZE_LABELS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
] as const;

export type StandardSizeLabel = (typeof STANDARD_SIZE_LABELS)[number];

export const DEFAULT_BASE_SIZE_LABEL: StandardSizeLabel = "M";

export type SizeBlockRowSeed = {
  measurementKey: string;
  /** Hundredths of an inch at base size (M). */
  baseValue: number;
  /** Default step in hundredths. */
  gradeIncrement: number;
  /** Per-label step override (hundredths), applied only on the step INTO that label. */
  gradeOverrides?: Record<string, number>;
  sortOrder: number;
};

export type SizeBlockSeed = {
  categoryKey: string;
  name: string;
  notes: string;
  rows: readonly SizeBlockRowSeed[];
};

/** Inches → hundredths. */
export function inches(n: number): number {
  return Math.round(n * 100);
}

/**
 * Seed exit check — same accumulation rule as Step 15 `resolveChart`.
 * Kept here so Step 14 can assert without building the full engine module yet.
 */
export function resolveRowValues(
  sizeLabels: readonly string[],
  baseSizeLabel: string,
  baseValue: number,
  gradeIncrement: number,
  gradeOverrides: Record<string, number> = {},
): number[] {
  const baseIdx = sizeLabels.indexOf(baseSizeLabel);
  if (baseIdx < 0) {
    throw new Error(`baseSizeLabel ${baseSizeLabel} not in sizeLabels`);
  }
  return sizeLabels.map((_, targetIdx) => {
    const steps = targetIdx - baseIdx;
    let value = baseValue;
    const dir = Math.sign(steps);
    for (let i = 1; i <= Math.abs(steps); i++) {
      const label = sizeLabels[baseIdx + i * dir];
      if (label === undefined) throw new Error("size label index out of range");
      const step = gradeOverrides[label] ?? gradeIncrement;
      value += step * dir;
    }
    return value;
  });
}

export const DEFAULT_SIZE_BLOCK_SEEDS: readonly SizeBlockSeed[] = [
  {
    categoryKey: "KAMEEZ",
    name: "KAMEEZ default (placeholder)",
    notes:
      "REPLACEABLE placeholder — replace with designer pattern-block numbers before real orders.",
    rows: [
      {
        measurementKey: "BUST",
        baseValue: inches(36),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
        sortOrder: 10,
      },
      {
        measurementKey: "WAIST",
        baseValue: inches(32),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
        sortOrder: 20,
      },
      {
        measurementKey: "HIP",
        baseValue: inches(38),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
        sortOrder: 30,
      },
      {
        measurementKey: "SHOULDER",
        baseValue: inches(14.5),
        gradeIncrement: inches(0.5),
        sortOrder: 40,
      },
      {
        measurementKey: "SLEEVE_LENGTH",
        baseValue: inches(23),
        gradeIncrement: inches(0.5),
        sortOrder: 50,
      },
      {
        measurementKey: "ARMHOLE",
        baseValue: inches(17),
        gradeIncrement: inches(0.5),
        sortOrder: 60,
      },
      {
        measurementKey: "LENGTH",
        baseValue: inches(30),
        gradeIncrement: inches(1),
        sortOrder: 70,
      },
    ],
  },
  {
    categoryKey: "TROUSER",
    name: "TROUSER default (placeholder)",
    notes:
      "REPLACEABLE placeholder — replace with designer pattern-block numbers before real orders.",
    rows: [
      {
        measurementKey: "WAIST",
        baseValue: inches(30),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
        sortOrder: 10,
      },
      {
        measurementKey: "HIP",
        baseValue: inches(38),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
        sortOrder: 20,
      },
      {
        measurementKey: "THIGH",
        baseValue: inches(22),
        gradeIncrement: inches(1),
        sortOrder: 30,
      },
      {
        measurementKey: "RISE",
        baseValue: inches(11),
        gradeIncrement: inches(0.25),
        sortOrder: 40,
      },
      {
        measurementKey: "LENGTH",
        baseValue: inches(38),
        gradeIncrement: inches(0.5),
        sortOrder: 50,
      },
      {
        measurementKey: "BOTTOM_OPENING",
        baseValue: inches(14),
        gradeIncrement: inches(0.5),
        sortOrder: 60,
      },
    ],
  },
  {
    categoryKey: "GOWN",
    name: "GOWN default (placeholder)",
    notes:
      "REPLACEABLE placeholder — replace with designer pattern-block numbers before real orders.",
    rows: [
      {
        measurementKey: "BUST",
        baseValue: inches(36),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
        sortOrder: 10,
      },
      {
        measurementKey: "WAIST",
        baseValue: inches(32),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
        sortOrder: 20,
      },
      {
        measurementKey: "HIP",
        baseValue: inches(38),
        gradeIncrement: inches(2),
        gradeOverrides: { XL: inches(3), XXL: inches(3) },
        sortOrder: 30,
      },
      {
        measurementKey: "SHOULDER",
        baseValue: inches(14.5),
        gradeIncrement: inches(0.5),
        sortOrder: 40,
      },
      {
        measurementKey: "SLEEVE_LENGTH",
        baseValue: inches(23),
        gradeIncrement: inches(0.5),
        sortOrder: 50,
      },
      {
        measurementKey: "ARMHOLE",
        baseValue: inches(17),
        gradeIncrement: inches(0.5),
        sortOrder: 60,
      },
      {
        measurementKey: "LENGTH",
        baseValue: inches(52),
        gradeIncrement: inches(1),
        sortOrder: 70,
      },
      {
        measurementKey: "SWEEP",
        baseValue: inches(60),
        gradeIncrement: inches(2),
        sortOrder: 80,
      },
    ],
  },
];
