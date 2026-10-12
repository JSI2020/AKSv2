import { describe, expect, it } from "vitest";

import {
  canClearPhone,
  canDisconnectProvider,
  signInMethodCount,
} from "./methods";

const base = {
  email: "you@example.com",
  phone: "923001234567",
  providers: ["facebook"],
};

describe("sign-in methods", () => {
  it("ignores placeholder emails", () => {
    expect(
      signInMethodCount({
        email: "fb.1@customers.aks.local",
        phone: null,
        providers: ["facebook"],
      }),
    ).toBe(1);
  });

  it("refuses to remove the last way in", () => {
    const onlyFacebook = {
      email: "fb.1@customers.aks.local",
      phone: null,
      providers: ["facebook"],
    };
    expect(canDisconnectProvider(onlyFacebook, "facebook")).toBe(false);
    expect(canDisconnectProvider(base, "facebook")).toBe(true);
    expect(canClearPhone(onlyFacebook)).toBe(true);
    expect(
      canClearPhone({
        email: "fb.1@customers.aks.local",
        phone: "923001234567",
        providers: [],
      }),
    ).toBe(false);
  });
});
