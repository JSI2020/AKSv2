import { describe, expect, it } from "vitest";

import { resolveDisplayPrice, resolvePercentOffBadge } from "./pricing";

describe("resolveDisplayPrice", () => {
  it("shows compare-at only inside the schedule window", () => {
    const base = {
      basePriceMinor: 20_000_00,
      compareAtPriceMinor: 28_000_00,
      compareAtStartsAt: new Date("2026-01-01T00:00:00Z"),
      compareAtEndsAt: new Date("2026-12-31T00:00:00Z"),
    };
    expect(resolveDisplayPrice(base, new Date("2026-06-01")).onSale).toBe(true);
    expect(resolveDisplayPrice(base, new Date("2025-06-01")).onSale).toBe(false);
    expect(resolveDisplayPrice(base, new Date("2027-01-01")).compareAtMinor).toBeNull();
  });
});

describe("resolvePercentOffBadge", () => {
  it("gives design compare-at priority over automatic category discount", () => {
    expect(
      resolvePercentOffBadge({ compareAtPercent: 15, automaticPercent: 30 }),
    ).toBe(15);
    expect(
      resolvePercentOffBadge({ compareAtPercent: null, automaticPercent: 20 }),
    ).toBe(20);
    expect(
      resolvePercentOffBadge({ compareAtPercent: null, automaticPercent: null }),
    ).toBeNull();
  });
});
