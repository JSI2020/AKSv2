import { describe, expect, it } from "vitest";

import {
  HOUSE_PLACEHOLDER_DOMAIN,
  customerDisplayName,
  emailVerifiedStamp,
  ensureOAuthProfileEmail,
  isHousePlaceholderEmail,
  isSocialOAuthProvider,
  socialPlaceholderEmail,
  supportsPlaceholderEmail,
} from "./identity";

describe("social identity", () => {
  it("recognises house placeholder addresses", () => {
    expect(isHousePlaceholderEmail(`fb.1${HOUSE_PLACEHOLDER_DOMAIN}`)).toBe(
      true,
    );
    expect(isHousePlaceholderEmail("shopper@example.com")).toBe(false);
    expect(isHousePlaceholderEmail(null)).toBe(false);
  });

  it("builds a stable placeholder and hashes unsafe subjects", () => {
    expect(socialPlaceholderEmail("facebook", "12345")).toBe(
      `fb.12345${HOUSE_PLACEHOLDER_DOMAIN}`,
    );
    expect(socialPlaceholderEmail("instagram", "9988")).toBe(
      `ig.9988${HOUSE_PLACEHOLDER_DOMAIN}`,
    );
    const hashed = socialPlaceholderEmail("tiktok", "open id with spaces");
    expect(hashed).toMatch(
      new RegExp(
        `^tt\\.[a-f0-9]{32}${HOUSE_PLACEHOLDER_DOMAIN.replace(".", "\\.")}$`,
      ),
    );
    expect(socialPlaceholderEmail("tiktok", "open id with spaces")).toBe(
      hashed,
    );
    expect(socialPlaceholderEmail("facebook", "   ")).toBeNull();
  });

  it("keeps a real email and fills a placeholder when the provider withholds one", () => {
    expect(
      ensureOAuthProfileEmail({
        provider: "facebook",
        email: "  Shopper@Example.com ",
        providerAccountId: "1",
      }),
    ).toBe("shopper@example.com");
    expect(
      ensureOAuthProfileEmail({
        provider: "instagram",
        email: null,
        providerAccountId: "1784",
      }),
    ).toBe(`ig.1784${HOUSE_PLACEHOLDER_DOMAIN}`);
    expect(
      ensureOAuthProfileEmail({
        provider: "google",
        email: null,
        providerAccountId: "g",
      }),
    ).toBeNull();
    expect(
      ensureOAuthProfileEmail({
        provider: "tiktok",
        email: "",
        providerAccountId: "",
      }),
    ).toBeNull();
  });

  it("does not mark placeholder addresses verified", () => {
    const now = new Date("2026-10-11T00:00:00.000Z");
    const existing = new Date("2026-01-01T00:00:00.000Z");
    expect(emailVerifiedStamp("shopper@example.com", now, null)).toEqual(now);
    expect(emailVerifiedStamp("shopper@example.com", now, existing)).toEqual(
      existing,
    );
    expect(
      emailVerifiedStamp(`ig.1${HOUSE_PLACEHOLDER_DOMAIN}`, now, null),
    ).toBeNull();
    expect(emailVerifiedStamp(null, now, existing)).toEqual(existing);
  });

  it("names a customer without using a placeholder local-part", () => {
    expect(customerDisplayName({ name: "  Amina ", email: "a@b.c" })).toBe(
      "Amina",
    );
    expect(customerDisplayName({ email: "amina@example.com" })).toBe("amina");
    expect(
      customerDisplayName({
        email: `fb.99${HOUSE_PLACEHOLDER_DOMAIN}`,
        phone: "923001112233",
      }),
    ).toBe("Customer 2233");
    expect(customerDisplayName({})).toBe("Customer");
  });

  it("classifies oauth providers", () => {
    expect(isSocialOAuthProvider("instagram")).toBe(true);
    expect(isSocialOAuthProvider("whatsapp")).toBe(false);
    expect(supportsPlaceholderEmail("tiktok")).toBe(true);
    expect(supportsPlaceholderEmail("google")).toBe(false);
  });
});
