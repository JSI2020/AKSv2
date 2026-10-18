import { describe, expect, it } from "vitest";

import { staffOtpGate } from "./staff-otp";

describe("staffOtpGate", () => {
  it("refuses a missing email", () => {
    expect(staffOtpGate(null)).toEqual({
      ok: false,
      error: "That email is not a staff account, so no code was sent.",
    });
  });

  it("refuses a customer", () => {
    expect(
      staffOtpGate({ role: "CUSTOMER", status: "ACTIVE", deletedAt: null }),
    ).toEqual({
      ok: false,
      error: "That email is not a staff account, so no code was sent.",
    });
  });

  it("refuses a disabled staff account with a distinct message", () => {
    expect(
      staffOtpGate({ role: "OWNER", status: "DISABLED", deletedAt: null }),
    ).toEqual({
      ok: false,
      error: "This staff account is disabled, so no code was sent.",
    });
  });

  it("allows an active owner", () => {
    expect(
      staffOtpGate({ role: "OWNER", status: "ACTIVE", deletedAt: null }),
    ).toEqual({ ok: true });
  });
});
