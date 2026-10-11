import { createHmac, timingSafeEqual } from "node:crypto";

export const OAUTH_LINK_COOKIE = "aks_oauth_link";
const TTL_MS = 10 * 60 * 1000;

export type OAuthLinkDecision = "attach" | "refuse" | "continue";

export function signOAuthLinkCookie(
  userId: string,
  secret: string,
  expiresAt: number,
): string {
  const payload = `${userId}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readOAuthLinkCookie(
  value: string | undefined,
  secret: string,
  now: number,
): string | null {
  if (!value || !secret) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expRaw, sig] = parts;
  if (!userId || !expRaw || !sig) return null;
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null;
  const payload = `${userId}.${expRaw}`;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export function oauthLinkExpiresAt(now = Date.now()): number {
  return now + TTL_MS;
}

type LinkOwner = {
  id: string;
  role: string;
  status: string;
  deletedAt: Date | null;
  email: string;
};

/**
 * While a customer is signed in, a social button should attach that provider
 * to their account. A provider already used by someone else is refused.
 * With no link cookie, sign-in continues as a normal login.
 */
export function oauthLinkDecision(input: {
  linkUserId: string | null;
  owner: LinkOwner | null;
  existingAccountUserId: string | null;
}): OAuthLinkDecision {
  if (!input.linkUserId) return "continue";
  const owner = input.owner;
  if (
    !owner ||
    owner.id !== input.linkUserId ||
    owner.role !== "CUSTOMER" ||
    owner.status === "DISABLED" ||
    owner.deletedAt
  ) {
    return "refuse";
  }
  if (input.existingAccountUserId && input.existingAccountUserId !== owner.id) {
    return "refuse";
  }
  return "attach";
}
