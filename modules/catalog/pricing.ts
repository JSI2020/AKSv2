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
    };
  }

  const starts = input.compareAtStartsAt;
  const ends = input.compareAtEndsAt;
  const afterStart = !starts || starts.getTime() <= now.getTime();
  const beforeEnd = !ends || ends.getTime() >= now.getTime();
  const onSale = afterStart && beforeEnd;

  return {
    priceMinor: input.basePriceMinor,
    compareAtMinor: onSale ? compare : null,
    onSale,
  };
}
