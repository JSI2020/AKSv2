import { describe, expect, it } from "vitest";

import {
  HOUSE_DEFAULT_LEAD_DAYS,
  leadDaysFromSources,
  promisedDayCount,
  promisedShipDateFromDays,
} from "./promised-lead";

describe("promised lead time", () => {
  it("prefers a design override, then storefront days, then the house default", () => {
    expect(
      leadDaysFromSources({
        designLeadDays: [10, 21],
        siteMin: 7,
        siteMax: 14,
      }),
    ).toBe(21);
    expect(
      leadDaysFromSources({
        designLeadDays: [null],
        siteMin: 7,
        siteMax: 14,
      }),
    ).toBe(14);
    expect(
      leadDaysFromSources({
        designLeadDays: [],
        siteMin: 0,
        siteMax: 0,
      }),
    ).toBe(HOUSE_DEFAULT_LEAD_DAYS);
  });

  it("counts promised days from the stored date or the fallback", () => {
    const placed = new Date("2026-10-01T00:00:00Z");
    const promised = promisedShipDateFromDays(placed, 14);
    expect(promisedDayCount(placed, promised, null)).toBe(14);
    expect(promisedDayCount(placed, null, 14)).toBe(14);
  });
});
