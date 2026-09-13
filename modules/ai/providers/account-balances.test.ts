import { describe, expect, it } from "vitest";

import {
  parseDeepseekBalanceJson,
  parseFalBillingJson,
} from "./account-balances";

describe("parseFalBillingJson", () => {
  it("reads credits when expanded", () => {
    expect(
      parseFalBillingJson({
        username: "aks-team",
        credits: { current_balance: 24.5, currency: "USD" },
      }),
    ).toEqual({ balance: 24.5, currency: "USD", username: "aks-team" });
  });

  it("errors when credits missing", () => {
    const parsed = parseFalBillingJson({ username: "aks-team" });
    expect("error" in parsed).toBe(true);
  });
});

describe("parseDeepseekBalanceJson", () => {
  it("prefers USD when present", () => {
    expect(
      parseDeepseekBalanceJson({
        is_available: true,
        balance_infos: [
          {
            currency: "CNY",
            total_balance: "10.00",
            granted_balance: "0",
            topped_up_balance: "10.00",
          },
          {
            currency: "USD",
            total_balance: "3.50",
            granted_balance: "0.50",
            topped_up_balance: "3.00",
          },
        ],
      }),
    ).toEqual({
      balance: 3.5,
      currency: "USD",
      granted: 0.5,
      toppedUp: 3,
      available: true,
    });
  });

  it("errors on empty balance_infos", () => {
    const parsed = parseDeepseekBalanceJson({
      is_available: false,
      balance_infos: [],
    });
    expect("error" in parsed).toBe(true);
  });
});
