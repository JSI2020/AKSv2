/**
 * Decisions for storefront OAuth that Auth.js would otherwise get wrong:
 * a stale session cookie must not capture a new provider, and a provider
 * already stuck on a disabled account must not block the shopper.
 */

export type OAuthAccountOwner = {
  role: string;
  status: string;
  deletedAt: Date | null;
};

export type StuckOAuthAccountAction = "keep" | "release" | "refuse";

/** Only a live customer may be treated as already signed in during OAuth. */
export function oauthSessionUserLinkable(
  user:
    | {
        role?: string | null;
        status?: string | null;
        deletedAt?: Date | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (user.deletedAt) return false;
  if (user.status !== "ACTIVE") return false;
  return user.role === "CUSTOMER";
}

/**
 * keep — the provider already belongs to a live customer.
 * release — disabled or deleted owner; drop the row so sign-in can continue.
 * refuse — the provider belongs to staff. Do not detach it from here.
 */
export function stuckOAuthAccountAction(
  owner: OAuthAccountOwner | null,
): StuckOAuthAccountAction {
  if (!owner) return "keep";
  if (owner.deletedAt || owner.status === "DISABLED") return "release";
  if (owner.role !== "CUSTOMER" || owner.status !== "ACTIVE") return "refuse";
  return "keep";
}

/** Email on the provider profile. Never the email of a previously linked user. */
export function emailFromOAuthProfile(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const email = (profile as { email?: unknown }).email;
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  return trimmed.includes("@") ? trimmed : null;
}
