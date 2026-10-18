import { describe, expect, it } from "vitest";

import {
  validateAccountEmail,
  validateAccountPhone,
  validateDeleteConfirmation,
  validateDisplayName,
  validateSavedAddress,
} from "./profile-input";

describe("account profile input", () => {
  it("accepts a name, a Pakistan phone, and a readable email", () => {
    expect(validateDisplayName("  Amina   Khan ").name).toBe("Amina Khan");
    expect(validateAccountPhone("0300 1234567").phone).toBe("03001234567");
    expect(validateAccountPhone("").phone).toBeNull();
    expect(validateAccountEmail("You@Example.com").email).toBe(
      "you@example.com",
    );
    expect(validateAccountEmail("fb.1@customers.aks.local").ok).toBe(false);
    expect(validateAccountPhone("123").ok).toBe(false);
  });

  it("requires a Pakistani province on a saved address", () => {
    const bad = validateSavedAddress({
      recipientName: "Amina Khan",
      phone: "03001234567",
      addressLine1: "12 Street",
      city: "Lahore",
      province: "BERLIN",
    });
    expect(bad.ok).toBe(false);
    const good = validateSavedAddress({
      recipientName: "Amina Khan",
      phone: "03001234567",
      addressLine1: "12 Street",
      city: "Lahore",
      province: "PUNJAB",
    });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.data.province).toBe("PUNJAB");
  });

  it("requires the word DELETE", () => {
    expect(validateDeleteConfirmation("delete").ok).toBe(false);
    expect(validateDeleteConfirmation("DELETE").ok).toBe(true);
  });
});
