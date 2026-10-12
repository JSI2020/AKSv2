const CANCELLED_ERRORS = new Set([
  "access_denied",
  "user_denied",
  "user_cancelled",
  "access_cancelled",
]);

export type OAuthCallbackFailure = {
  kind: "cancelled" | "denied" | "provider";
  message: string;
};

/**
 * Provider redirect errors, before any token exchange.
 * `access_denied` is what Facebook, Instagram, and TikTok send when the
 * shopper closes or declines the consent screen.
 */
export function classifyOAuthCallbackQuery(query: {
  error?: string | null;
  error_reason?: string | null;
  error_description?: string | null;
}): OAuthCallbackFailure | null {
  const error = query.error?.trim();
  if (!error) return null;
  if (CANCELLED_ERRORS.has(error)) {
    return {
      kind: "cancelled",
      message: "Sign-in was cancelled. Nothing was changed.",
    };
  }
  const reason =
    `${query.error_reason ?? ""} ${query.error_description ?? ""}`.toLowerCase();
  if (reason.includes("cancel")) {
    return {
      kind: "cancelled",
      message: "Sign-in was cancelled. Nothing was changed.",
    };
  }
  return {
    kind: "provider",
    message: "That sign-in didn't finish. Try again, or use an email code.",
  };
}

export type CustomerOAuthErrorKey =
  | "errorOAuthAccessDenied"
  | "errorOAuthNotLinked"
  | "errorOAuthCancelled"
  | "errorOAuthGeneric";

/**
 * Auth.js error code on `/account/login?error=`.
 * User-cancelled consent arrives as `OAuthCallbackError` (the provider's
 * `access_denied` is swallowed by Auth.js). `AccessDenied` is our signIn
 * callback refusing a staff or disabled account.
 */
export function customerOAuthErrorKey(
  error: string | null | undefined,
): CustomerOAuthErrorKey | null {
  if (!error) return null;
  switch (error) {
    case "AccessDenied":
      return "errorOAuthAccessDenied";
    case "OAuthAccountNotLinked":
      return "errorOAuthNotLinked";
    case "access_denied":
    case "user_denied":
    case "user_cancelled":
      return "errorOAuthCancelled";
    default:
      return "errorOAuthGeneric";
  }
}
