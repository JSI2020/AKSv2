import { publicSiteOrigin } from "@/modules/legal/routes";

const STAFF_AUTH_ERRORS = new Set([
  "CredentialsSignin",
  "SessionRequired",
  "Verification",
]);

/** Path Auth.js error codes should land on. Shop errors stay on the shop. */
export function authErrorRedirectPath(error: string | null | undefined): string {
  const code = error?.trim() || "Default";
  const path = STAFF_AUTH_ERRORS.has(code) ? "/admin/login" : "/account/login";
  return `${path}?error=${encodeURIComponent(code)}`;
}

/**
 * Absolute redirect for `/auth/error`.
 * Route handlers behind the reverse proxy see `request.url` as the bind
 * address (`https://0.0.0.0:3000`). Auth redirects must use the public site.
 */
export function authErrorRedirectUrl(
  error: string | null | undefined,
  origin: string = publicSiteOrigin(),
): URL {
  return new URL(authErrorRedirectPath(error), origin);
}
