import type {
  ChartCell,
  ChartGrid,
  PinnedCellInput,
  SizeBlockInput,
  SizeBlockRowInput,
} from "./types";

export class SizingEngineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SizingEngineError";
    this.code = code;
  }
}

/**
 * Resolve one size for a row by accumulating per-step increments from the base.
 * An override at XL affects only the L→XL step, not the whole run.
 */
export function resolveCellValue(
  block: SizeBlockInput,
  row: SizeBlockRowInput,
  sizeLabel: string,
): number {
  const labels = block.sizeLabels;
  const baseIdx = labels.indexOf(block.baseSizeLabel);
  if (baseIdx < 0) {
    throw new SizingEngineError(
      "INVALID_BASE_SIZE",
      `baseSizeLabel "${block.baseSizeLabel}" is not in sizeLabels`,
    );
  }
  const targetIdx = labels.indexOf(sizeLabel);
  if (targetIdx < 0) {
    throw new SizingEngineError(
      "INVALID_SIZE_LABEL",
      `sizeLabel "${sizeLabel}" is not in sizeLabels`,
    );
  }

  const steps = targetIdx - baseIdx;
  let value = row.baseValue;
  const dir = Math.sign(steps) as -1 | 0 | 1;
  if (dir === 0) return value;

  const overrides = row.gradeOverrides ?? {};
  for (let i = 1; i <= Math.abs(steps); i++) {
    const label = labels[baseIdx + i * dir]!;
    const step = overrides[label] ?? row.gradeIncrement;
    value += step * dir;
  }
  return value;
}

/**
 * Build the full chart grid. Pinned cells win; everything else is computed.
 */
export function resolveChart(
  block: SizeBlockInput,
  rows: readonly SizeBlockRowInput[],
  pinnedCells: readonly PinnedCellInput[] = [],
): ChartGrid {
  const pinMap = new Map<string, number>();
  for (const pin of pinnedCells) {
    pinMap.set(`${pin.measurementKey}\0${pin.sizeLabel}`, pin.value);
  }

  const grid: ChartGrid = {};
  for (const row of rows) {
    const rowGrid: Record<string, ChartCell> = {};
    for (const sizeLabel of block.sizeLabels) {
      const pinKey = `${row.measurementKey}\0${sizeLabel}`;
      const pinnedValue = pinMap.get(pinKey);
      if (pinnedValue !== undefined) {
        rowGrid[sizeLabel] = { value: pinnedValue, pinned: true };
      } else {
        rowGrid[sizeLabel] = {
          value: resolveCellValue(block, row, sizeLabel),
          pinned: false,
        };
      }
    }
    grid[row.measurementKey] = rowGrid;
  }
  return grid;
}
