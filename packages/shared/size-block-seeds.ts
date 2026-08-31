/**
 * Default size-block seeds — research-backed where measured, proposed placeholders otherwise.
 * Regenerate research blocks: `npm run db:generate:sizing-research`
 */

import type { CategorySeed } from "./sizing-catalogue";
import { GARMENT_CATEGORY_SEEDS } from "./sizing-catalogue";
import { RESEARCH_MEASURED_BLOCK_SEEDS } from "./sizing-research/research-measured-blocks";
import { flatToFinished } from "./sizing-research/measurement-basis";

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
  /** Hundredths of an inch (or metre for fabric-length keys) at base size. */
  baseValue: number;
  gradeIncrement: number;
  gradeOverrides?: Record<string, number>;
  sortOrder: number;
};

export type SizeBlockSeed = {
  categoryKey: string;
  name: string;
  notes: string;
  rows: readonly SizeBlockRowSeed[];
  /** When set, overrides STANDARD_SIZE_LABELS (e.g. XS–7XL research charts). */
  sizeLabels?: readonly string[];
  baseSizeLabel?: string;
};

/** Inches → hundredths. */
export function inches(n: number): number {
  return Math.round(n * 100);
}

/** Metres → hundredths. */
export function metres(n: number): number {
  return Math.round(n * 100);
}

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

const MEASURED_KEYS = new Set(
  RESEARCH_MEASURED_BLOCK_SEEDS.map((b) => b.categoryKey),
);

function defaultBaseForKey(key: string, productType?: string): number {
  if (productType === "fabric") {
    if (key.includes("WIDTH")) return metres(1.1);
    return metres(2.5);
  }
  if (/^(BUST|CHEST|HIP|WAIST|LOWER_WAIST|UPPER_WAIST)/.test(key)) {
    return inches(36);
  }
  if (/^(SHOULDER|RISE|ARMHOLE|SLEEVE)/.test(key)) return inches(14);
  if (/^(LENGTH|SWEEP|BOTTOM_OPENING|THIGH|KNEE)/.test(key)) return inches(38);
  if (key === "WIDTH") return inches(36);
  return inches(30);
}

function placeholderBlock(cat: CategorySeed): SizeBlockSeed {
  const isFabric = cat.productType === "fabric";
  const isAccessory = cat.productType === "accessory";
  const status = cat.evidenceStatus ?? "Proposed";
  return {
    categoryKey: cat.key,
    name: `${cat.key} default (${status.toLowerCase()})`,
    notes:
      status === "Measured"
        ? "Category has research evidence but no default chart was derived yet — replace with house blocks."
        : status === "Confirmed"
          ? "Confirmed category — replace placeholder numbers with designer pattern blocks before production."
          : "Proposed category — configure when the house adopts this silhouette.",
    sizeLabels: isFabric || isAccessory ? ["One size"] : [...STANDARD_SIZE_LABELS],
    baseSizeLabel: isFabric || isAccessory ? "One size" : DEFAULT_BASE_SIZE_LABEL,
    rows: cat.measurementKeys.map((key, i) => ({
      measurementKey: key,
      baseValue: defaultBaseForKey(key, cat.productType),
      gradeIncrement: isFabric || isAccessory ? 0 : inches(2),
      sortOrder: (i + 1) * 10,
    })),
  };
}

const PLACEHOLDER_BLOCKS: SizeBlockSeed[] = GARMENT_CATEGORY_SEEDS.filter(
  (c) => !MEASURED_KEYS.has(c.key),
).map(placeholderBlock);

/**
 * The research blocks were captured on flat-laid garments, so every loop
 * measurement in them is half its finished circumference. Charts store finished
 * circumferences, so convert on the way in — base values, grade increments and
 * per-size overrides alike, since all three are in the same units.
 */
export const DEFAULT_SIZE_BLOCK_SEEDS: readonly SizeBlockSeed[] = [
  ...RESEARCH_MEASURED_BLOCK_SEEDS.map(
    ({ sizeLabels, baseSizeLabel, rows, ...rest }) => ({
      ...rest,
      sizeLabels: [...sizeLabels],
      baseSizeLabel,
      rows: rows.map((row) => ({
        ...row,
        baseValue: flatToFinished(
          row.measurementKey,
          row.baseValue,
          row.baseValue,
        ),
        gradeIncrement: flatToFinished(
          row.measurementKey,
          row.gradeIncrement,
          row.baseValue,
        ),
        gradeOverrides: row.gradeOverrides
          ? Object.fromEntries(
              Object.entries(row.gradeOverrides).map(([size, step]) => [
                size,
                flatToFinished(row.measurementKey, step, row.baseValue),
              ]),
            )
          : row.gradeOverrides,
      })),
    }),
  ),
  ...PLACEHOLDER_BLOCKS,
];
