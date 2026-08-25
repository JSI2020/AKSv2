import { describe, expect, it } from "vitest";

import {
  expandExpendituresForRange,
  sumExpandedMinor,
  sumRecurringExpandedMinor,
  type ExpenditureRow,
} from "./expenditures-math";

const base: Omit<ExpenditureRow, "id" | "date" | "payee" | "amountMinor"> = {
  category: "RENT",
  paymentMethod: "BANK_TRANSFER",
  isRecurring: true,
  recurrenceCycle: "MONTHLY",
  endedAt: null,
  note: null,
};

describe("expandExpendituresForRange", () => {
  it("includes one-off only when date in range", () => {
    const rows: ExpenditureRow[] = [
      {
        ...base,
        id: "1",
        date: new Date("2026-08-08T00:00:00Z"),
        payee: "Ads",
        amountMinor: 15_000_00,
        isRecurring: false,
        recurrenceCycle: null,
        category: "MARKETING",
      },
    ];
    const inRange = expandExpendituresForRange(
      rows,
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-31T23:59:59Z"),
    );
    expect(inRange).toHaveLength(1);
    const out = expandExpendituresForRange(
      rows,
      new Date("2026-07-01T00:00:00Z"),
      new Date("2026-07-31T23:59:59Z"),
    );
    expect(out).toHaveLength(0);
  });

  it("expands monthly recurring across months in range", () => {
    const rows: ExpenditureRow[] = [
      {
        ...base,
        id: "rent",
        date: new Date("2026-01-01T00:00:00Z"),
        payee: "Landlord",
        amountMinor: 45_000_00,
      },
    ];
    const q = expandExpendituresForRange(
      rows,
      new Date("2026-07-01T00:00:00Z"),
      new Date("2026-09-30T23:59:59Z"),
    );
    expect(q).toHaveLength(3);
    expect(sumExpandedMinor(q)).toBe(135_000_00);
    expect(sumRecurringExpandedMinor(q)).toBe(135_000_00);
  });

  it("stops expanding after endedAt", () => {
    const rows: ExpenditureRow[] = [
      {
        ...base,
        id: "soft",
        date: new Date("2026-01-01T00:00:00Z"),
        payee: "Hosting",
        amountMinor: 8_000_00,
        category: "SOFTWARE",
        endedAt: new Date("2026-07-31T23:59:59Z"),
      },
    ];
    const q = expandExpendituresForRange(
      rows,
      new Date("2026-07-01T00:00:00Z"),
      new Date("2026-09-30T23:59:59Z"),
    );
    expect(q).toHaveLength(1);
  });
});
