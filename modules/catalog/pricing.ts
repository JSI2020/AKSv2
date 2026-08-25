/** Integer minor-unit sale window helpers for scheduled compare-at pricing. */

export type CompareAtSchedule = {
  basePriceMinor: number;
  compareAtPriceMinor: number | null;
  compareAtStartsAt: Date | null;
  compareAtEndsAt: Date | null;
};

export type DisplayPrice = {
  /** Price the customer pays (always base for now — sale edits base, compare-at is the “was”). */
  priceMinor: number;
  /** Struck-through compare-at when the schedule is active and higher than price. */
  compareAtMinor: number | null;
  onSale: boolean;
  /** Computed % off when on sale — never typed by admin. */
  percentOff: number | null;
};

export function resolveDisplayPrice(
  input: CompareAtSchedule,
  now: Date = new Date(),
): DisplayPrice {
  const compare = input.compareAtPriceMinor;
  if (compare == null || compare <= input.basePriceMinor) {
    return {
      priceMinor: input.basePriceMinor,
      compareAtMinor: null,
      onSale: false,
      percentOff: null,
    };
  }

  const starts = input.compareAtStartsAt;
  const ends = input.compareAtEndsAt;
  const afterStart = !starts || starts.getTime() <= now.getTime();
  const beforeEnd = !ends || ends.getTime() >= now.getTime();
  const onSale = afterStart && beforeEnd;

  const percentOff =
    onSale && compare > 0
      ? Math.round(((compare - input.basePriceMinor) / compare) * 100)
      : null;

  return {
    priceMinor: input.basePriceMinor,
    compareAtMinor: onSale ? compare : null,
    onSale,
    percentOff: percentOff != null && percentOff > 0 ? percentOff : null,
  };
}

/**
 * Merge compare-at % off with an automatic percentage discount (collection/category).
 * Design-level compare-at discount always wins when present.
 */
export function resolvePercentOffBadge(input: {
  compareAtPercent: number | null;
  automaticPercent: number | null;
}): number | null {
  const design = input.compareAtPercent ?? 0;
  if (design > 0) return design;
  const auto = input.automaticPercent ?? 0;
  return auto > 0 ? auto : null;
}
