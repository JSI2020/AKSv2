import { describe, expect, it } from "vitest";

import {
  countHammingOnePairs,
  planMergeOrderReassignment,
  recomputeLifetimeStats,
} from "./merge-logic";
import {
  crmPlaceholderEmail,
  isPhoneCloseMatch,
  maskPhone,
  normalizePhoneDigits,
  phoneHammingDistance,
} from "./phone";

describe("normalizePhoneDigits", () => {
  it("strips non-digits", () => {
    expect(normalizePhoneDigits("+92 300-123-4567")).toBe("923001234567");
  });

  it("handles empty", () => {
    expect(normalizePhoneDigits("")).toBe("");
  });
});

describe("phoneHammingDistance / isPhoneCloseMatch", () => {
  it("exact match is distance 0", () => {
    expect(phoneHammingDistance("923001234567", "923001234567")).toBe(0);
    expect(isPhoneCloseMatch("+92 300 123 4567", "923001234567")).toBe(true);
  });

  it("one digit off is Hamming 1", () => {
    expect(phoneHammingDistance("923009998888", "923009998889")).toBe(1);
    expect(isPhoneCloseMatch("923009998888", "923009998889")).toBe(true);
  });

  it("two digits off is not a close match", () => {
    expect(phoneHammingDistance("923009998888", "923009998899")).toBe(2);
    expect(isPhoneCloseMatch("923009998888", "923009998899")).toBe(false);
  });

  it("different lengths are not close", () => {
    expect(phoneHammingDistance("923001234567", "3001234567")).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(isPhoneCloseMatch("923001234567", "3001234567")).toBe(false);
  });
});

describe("maskPhone / crmPlaceholderEmail", () => {
  it("masks PK numbers", () => {
    expect(maskPhone("923001234567")).toMatch(/3••/);
    expect(maskPhone("923001234567")).toContain("4567");
  });

  it("builds placeholder email from digits", () => {
    expect(crmPlaceholderEmail("+92-300-111")).toBe(
      "92300111@customers.aks.local",
    );
  });
});

describe("countHammingOnePairs", () => {
  it("counts unique Hamming-1 pairs", () => {
    const phones = ["923009998888", "923009998889", "923001234567"];
    expect(
      countHammingOnePairs(phones, normalizePhoneDigits, phoneHammingDistance),
    ).toBe(1);
  });
});

describe("merge order reassignment", () => {
  it("moves loser orders and recomputes LTV", () => {
    const plan = planMergeOrderReassignment({
      survivorUserId: "surv",
      loserUserId: "lose",
      loserWhatsappDigits: "923001111111",
      normalizePhone: normalizePhoneDigits,
      orders: [
        {
          id: "o1",
          userId: "surv",
          whatsappNumber: "923009999999",
          totalMinor: 10_000_00,
        },
        {
          id: "o2",
          userId: "lose",
          whatsappNumber: "923001111111",
          totalMinor: 5_000_00,
        },
        {
          id: "o3",
          userId: null,
          whatsappNumber: "923001111111",
          totalMinor: 2_000_00,
        },
      ],
    });

    expect(plan.orderIdsToSurvivor.sort()).toEqual(["o2", "o3"]);
    expect(plan.survivorOrderCount).toBe(3);
    expect(plan.survivorLifetimeValueMinor).toBe(17_000_00);
  });

  it("recomputeLifetimeStats sums totals", () => {
    expect(recomputeLifetimeStats([100, 200, 50])).toEqual({
      totalOrdersCount: 3,
      lifetimeValueMinor: 350,
    });
  });
});
