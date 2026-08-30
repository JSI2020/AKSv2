/**
 * Snap a measured garment onto the house standard-size grid.
 *
 * A sample garment is ONE physical size; the chart needs XS–XXL. Strategy:
 * subtract the garment's ease to get the body it was cut for, find the house
 * size whose body row sits closest (weighted, girths first), then let the
 * house grade rules produce every other size from the measured base. The
 * photo fixes the BASE accurately; grading stays a house decision — which is
 * exactly how a pattern room works.
 */

export type BodyRow = Record<string, number>; // measurement → hundredths
export type SizeGrid = Record<string, BodyRow>; // size label → body row

const DEFAULT_WEIGHTS: Record<string, number> = {
  bust: 3,
  chest: 3,
  waist: 2,
  hip: 2,
  shoulder: 1,
};

export type SizeSnap = {
  size: string;
  /** Per-measurement (bodyEquivalent − gridValue), hundredths. */
  deltas: Record<string, number>;
  /** Weighted RMS distance to the chosen row, hundredths. */
  score: number;
};

export function snapToSize(
  bodyEquivalent: BodyRow,
  grid: SizeGrid,
  weights: Record<string, number> = DEFAULT_WEIGHTS,
): SizeSnap | null {
  let best: SizeSnap | null = null;
  for (const [size, row] of Object.entries(grid)) {
    let sumW = 0;
    let sumSq = 0;
    const deltas: Record<string, number> = {};
    for (const [key, value] of Object.entries(bodyEquivalent)) {
      const gridValue = row[key];
      if (gridValue == null) continue;
      const w = weights[key] ?? 1;
      const d = value - gridValue;
      deltas[key] = d;
      sumW += w;
      sumSq += w * d * d;
    }
    if (sumW === 0) continue;
    const score = Math.sqrt(sumSq / sumW);
    if (!best || score < best.score) best = { size, deltas, score };
  }
  return best;
}
