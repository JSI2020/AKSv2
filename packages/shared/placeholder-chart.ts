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

export type ChartRowLike = {
  measurementKey: string;
  baseValue: number;
};

/**
 * True when the chart's girths are all the same value — the signature of the
 * seed fallback rather than a measured block.
 */
export function looksLikePlaceholderChart(
  rows: readonly ChartRowLike[],
): boolean {
  const girths = rows
    .filter((r) => GIRTH_KEYS.includes(r.measurementKey as never))
    .map((r) => r.baseValue);
  if (girths.length < 2) return false;
  return new Set(girths).size === 1;
}
