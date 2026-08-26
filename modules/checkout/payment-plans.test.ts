import { describe, expect, it } from "vitest";

import {
  computeDepositAmounts,
  getAvailablePaymentPlans,
  isPaymentPlanAllowed,
} from "./payment-plans";

describe("payment plans", () => {
  it("the 70/30 plan is retired — not offered and not allowed", () => {
    const lines = [{ sizeMode: "STANDARD" as const }];
    expect(isPaymentPlanAllowed("DEPOSIT_70_COD_30", lines)).toBe(false);

    const options = getAvailablePaymentPlans(lines);
    expect(options.find((o) => o.plan === "DEPOSIT_70_COD_30")).toBeUndefined();
    // Only standard COD-half and full-prepaid remain.
    expect(options.map((o) => o.plan).sort()).toEqual([
      "DEPOSIT_50_COD_50",
      "FULL_PREPAID",
    ]);
  });

  it("standard sizes allow 50/50", () => {
    const lines = [{ sizeMode: "STANDARD" as const }];
    expect(isPaymentPlanAllowed("DEPOSIT_50_COD_50", lines)).toBe(true);
    const options = getAvailablePaymentPlans(lines);
    expect(
      options.find((o) => o.plan === "DEPOSIT_50_COD_50")?.disabled,
    ).toBe(false);
  });

  it("computes deposit amounts in integer minor units", () => {
    expect(
      computeDepositAmounts({ totalMinor: 100_000, plan: "DEPOSIT_50_COD_50" }),
    ).toEqual({ depositAmountMinor: 50_000, balanceAmountMinor: 50_000 });

    expect(
      computeDepositAmounts({ totalMinor: 100_000, plan: "DEPOSIT_70_COD_30" }),
    ).toEqual({ depositAmountMinor: 70_000, balanceAmountMinor: 30_000 });

    expect(
      computeDepositAmounts({ totalMinor: 100_001, plan: "DEPOSIT_50_COD_50" }),
    ).toEqual({ depositAmountMinor: 50_001, balanceAmountMinor: 50_000 });
  });
});
