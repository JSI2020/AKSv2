import { describe, expect, it } from "vitest";

import {
  generateTempPassword,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from "./password";

describe("staff passwords", () => {
  it("hashes with a salt and verifies only the right password", async () => {
    const a = await hashPassword("correct horse 42");
    const b = await hashPassword("correct horse 42");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt:")).toBe(true);
    expect(await verifyPassword("correct horse 42", a)).toBe(true);
    expect(await verifyPassword("correct horse 43", a)).toBe(false);
  });

  it("never verifies when no password is set", async () => {
    expect(await verifyPassword("anything123", null)).toBe(false);
    expect(await verifyPassword("", undefined)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });

  it("generates readable one-time passwords", () => {
    const pw = generateTempPassword();
    expect(pw).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{4}-[A-HJ-NP-Za-km-np-z2-9]{4}-[A-HJ-NP-Za-km-np-z2-9]{4}$/);
    expect(generateTempPassword()).not.toBe(pw);
  });

  it("enforces the password rules", () => {
    expect(passwordProblem("short1")).toMatch(/10 characters/);
    expect(passwordProblem("onlyletters")).toMatch(/letter and one number/);
    expect(passwordProblem("1234567890")).toMatch(/letter and one number/);
    expect(passwordProblem("jawwad2026x", "jawwad@example.com")).toMatch(/email/);
    expect(passwordProblem("Silk-and-linen-77", "jawwad@example.com")).toBeNull();
  });
});
