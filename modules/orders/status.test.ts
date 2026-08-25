import { describe, expect, it } from "vitest";

import {
  derivePaymentStatus,
  deriveProductionStatus,
  dueTone,
  isOrderAtRisk,
  isOrderDueSoon,
  isOrderOverdue,
} from "./status";

describe("order status derivation", () => {
  it("keeps production and payment status independent", () => {
    expect(deriveProductionStatus("CUTTING")).toBe("CUTTING");
    expect(
      derivePaymentStatus({
        status: "CUTTING",
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
        status: "CUTTING",
      }),
    ).toBe(true);
    expect(
      isOrderAtRisk({
        promisedShipDate: soon,
        status: "COMPLETED",
      }),
    ).toBe(false);
  });

  it("splits due soon vs overdue", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const overdue = new Date("2026-08-28T12:00:00Z");
    const soon = new Date("2026-09-03T12:00:00Z");
    const ok = new Date("2026-09-12T12:00:00Z");

    expect(
      dueTone({ promisedShipDate: overdue, status: "STITCHING", now }),
    ).toBe("overdue");
    expect(
      isOrderOverdue({ promisedShipDate: overdue, status: "STITCHING", now }),
    ).toBe(true);
    expect(
      isOrderDueSoon({ promisedShipDate: soon, status: "CUTTING", now }),
    ).toBe(true);
    expect(dueTone({ promisedShipDate: ok, status: "CUTTING", now })).toBe(
      "ok",
    );
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
