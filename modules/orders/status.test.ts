import { describe, expect, it } from "vitest";

import {
  derivePaymentStatus,
  deriveProductionStatus,
  isOrderAtRisk,
} from "./status";

describe("order status derivation", () => {
  it("keeps production and payment status independent", () => {
    expect(deriveProductionStatus("IN_PRODUCTION")).toBe("IN_PRODUCTION");
    expect(
      derivePaymentStatus({
        status: "IN_PRODUCTION",
        balanceAmountMinor: 25_000_00,
        paidMinor: 75_000_00,
        totalMinor: 100_000_00,
      }),
    ).toBe("BALANCE_DUE");
  });

  it("marks orders at risk near promised ship date", () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(
      isOrderAtRisk({
        promisedShipDate: soon,
        status: "IN_PRODUCTION",
      }),
    ).toBe(true);
    expect(
      isOrderAtRisk({
        promisedShipDate: soon,
        status: "COMPLETED",
      }),
    ).toBe(false);
  });

  it("derives paid in full when recorded payments cover total", () => {
    expect(
      derivePaymentStatus({
        status: "READY_TO_SHIP",
        balanceAmountMinor: 0,
        paidMinor: 100_000_00,
        totalMinor: 100_000_00,
      }),
    ).toBe("PAID");
  });
});
