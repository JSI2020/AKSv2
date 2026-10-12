/** Catalogue seed when a design and the storefront have not set a lead time. */
export const HOUSE_DEFAULT_LEAD_DAYS = 14;

export function leadDaysFromSources(input: {
  designLeadDays: Array<number | null | undefined>;
  siteMin?: number | null;
  siteMax?: number | null;
}): number {
  const overrides = input.designLeadDays.filter(
    (days): days is number => typeof days === "number" && days > 0,
  );
  if (overrides.length > 0) return Math.max(...overrides);
  const siteMax = input.siteMax ?? 0;
  const siteMin = input.siteMin ?? 0;
  if (siteMax > 0) return siteMax;
  if (siteMin > 0) return siteMin;
  return HOUSE_DEFAULT_LEAD_DAYS;
}

export function promisedShipDateFromDays(placedAt: Date, days: number): Date {
  return new Date(placedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Days promised at placement. Uses the stored date, else the lead-time fallback. */
export function promisedDayCount(
  placedAt: Date,
  promisedShipDate: Date | null,
  fallbackDays: number | null,
): number | null {
  if (promisedShipDate) {
    return Math.round(
      (promisedShipDate.getTime() - placedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
  }
  if (fallbackDays != null && fallbackDays > 0) return fallbackDays;
  return null;
}
