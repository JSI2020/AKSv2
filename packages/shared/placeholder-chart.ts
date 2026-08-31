/**
 * Detect a house chart that is still seed filler rather than a real block.
 *
 * Categories without researched measurements were seeded from a generic
 * fallback: every girth 36", every width 14", every length 38". That produces a
 * chart where bust, waist and hip are identical — which no garment has, and no
 * pattern room would cut. It grades and publishes exactly like a real chart, so
 * nothing surfaces the difference unless it is named.
 */

const GIRTH_KEYS = ["BUST", "CHEST", "WAIST", "HIP"] as const;

/** The generic girth the seeder writes when a category has no researched block. */
const SEED_FALLBACK_GIRTH = 3600;

export type ChartRowLike = {
  measurementKey: string;
  baseValue: number;
  gradeIncrement?: number;
};

/**
 * True when the chart's girths are all the same value — the signature of the
 * seed fallback rather than a measured block.
 */
export function looksLikePlaceholderChart(
  rows: readonly ChartRowLike[],
): boolean {
  if (rows.length < 2) return false;

  // Every row grading by the same NON-ZERO amount is the strongest tell. A real
  // block moves a girth a full size step while a shoulder seam barely moves, so
  // uniform grading only happens when the seeder filled one number in. All-zero
  // grading is different: that is a one-size piece (a dupatta, a shawl), which
  // is correct rather than unfinished.
  const grades = rows
    .map((r) => r.gradeIncrement)
    .filter((g): g is number => typeof g === "number");
  if (
    grades.length === rows.length &&
    new Set(grades).size === 1 &&
    grades[0] !== 0
  ) {
    return true;
  }

  // Identical girths AT THE SEED CONSTANT. A kaftan really is one tube, so
  // equal girths alone are not proof — equal girths sitting exactly on the
  // fallback's 36" are.
  const girths = rows
    .filter((r) => GIRTH_KEYS.includes(r.measurementKey as never))
    .map((r) => r.baseValue);
  if (girths.length < 2) return false;
  return new Set(girths).size === 1 && girths[0] === SEED_FALLBACK_GIRTH;
}
