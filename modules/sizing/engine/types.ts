/** Pure sizing types — no I/O, no framework. Values = integer hundredths of an inch. */

export type SizeBlockInput = {
  sizeLabels: readonly string[];
  baseSizeLabel: string;
};

export type SizeBlockRowInput = {
  measurementKey: string;
  baseValue: number;
  gradeIncrement: number;
  /** Per-label step override for the step INTO that label. */
  gradeOverrides?: Readonly<Record<string, number>>;
};

export type PinnedCellInput = {
  measurementKey: string;
  sizeLabel: string;
  value: number;
};

export type ChartCell = {
  value: number;
  pinned: boolean;
};

/** measurementKey → sizeLabel → cell */
export type ChartGrid = Record<string, Record<string, ChartCell>>;
