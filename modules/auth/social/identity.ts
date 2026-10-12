import { createHash } from "node:crypto";

/** House inboxes that are not deliverable addresses. CRM treats this domain as "no email". */
export const HOUSE_PLACEHOLDER_DOMAIN = "@customers.aks.local";

const PLACEHOLDER_PREFIX = {
  facebook: "fb",
  instagram: "ig",
  tiktok: "tt",
} as const;

export type PlaceholderSocialProvider = keyof typeof PLACEHOLDER_PREFIX;

const SOCIAL_OAUTH = new Set(["google", "facebook", "instagram", "tiktok"]);

/** Local-part safe, and short enough that `prefix.subject` stays within 64 chars. */
const SUBJECT_SAFE = /^[A-Za-z0-9._-]{1,60}$/;

export function isHousePlaceholderEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(HOUSE_PLACEHOLDER_DOMAIN);
}

export function isSocialOAuthProvider(
  provider: string,
): provider is "google" | "facebook" | "instagram" | "tiktok" {
  return SOCIAL_OAUTH.has(provider);
}

export function supportsPlaceholderEmail(
  provider: string,
): provider is PlaceholderSocialProvider {
  return (
    provider === "facebook" || provider === "instagram" || provider === "tiktok"
  );
}

/**
 * Stable stand-in address when a provider does not share an email.
 * Returning visitors with the same provider subject resolve to the same row.
 */
export function socialPlaceholderEmail(
  provider: PlaceholderSocialProvider,
  subject: string,
): string | null {
  const raw = subject.trim();
  if (!raw) return null;
  const local = SUBJECT_SAFE.test(raw)
    ? raw
    : createHash("sha256")
        .update(`${provider}:${raw}`)
        .digest("hex")
        .slice(0, 32);
  return `${PLACEHOLDER_PREFIX[provider]}.${local}${HOUSE_PLACEHOLDER_DOMAIN}`;
}

/**
 * Email Auth.js should persist. Real addresses pass through lowercased.
 * Facebook, Instagram, and TikTok fall back to a placeholder when the
 * provider withholds the address (common on Instagram, and on Facebook
 * accounts created from a phone).
 */
export function ensureOAuthProfileEmail(input: {
  provider: string;
  email?: string | null;
  providerAccountId?: string | null;
}): string | null {
  const email = input.email?.trim().toLowerCase();
  if (email && email.includes("@")) return email;
  if (!supportsPlaceholderEmail(input.provider)) return null;
  if (!input.providerAccountId) return null;
  return socialPlaceholderEmail(input.provider, input.providerAccountId);
}

/**
 * Placeholder addresses are not inboxes. Only a real provider email is stamped
 * verified. An existing stamp is kept.
 */
export function emailVerifiedStamp(
  email: string | null | undefined,
  now: Date,
  existing: Date | null | undefined,
): Date | null {
  if (!email || isHousePlaceholderEmail(email)) return existing ?? null;
  return existing ?? now;
}

export function customerDisplayName(input: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}): string {
  const named = input.name?.trim();
  if (named) return named;
  if (input.email && !isHousePlaceholderEmail(input.email)) {
    const local = input.email.split("@")[0]?.trim();
    if (local) return local;
  }
  const phone = input.phone?.replace(/\D/g, "") ?? "";
  if (phone.length >= 4) return `Customer ${phone.slice(-4)}`;
  return "Customer";
}
