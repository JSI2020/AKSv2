import { describe, expect, it } from "vitest";

import {
  SocialProviderError,
  graphErrorMessage,
  sanitizeProviderMessage,
} from "./errors";
import {
  classifyOAuthCallbackQuery,
  customerOAuthErrorKey,
} from "./oauth-errors";

describe("oauth callback errors", () => {
  it("treats a declined consent screen as a cancellation", () => {
    expect(
      classifyOAuthCallbackQuery({
        error: "access_denied",
        error_reason: "user_denied",
        error_description: "Permissions error",
      }),
    ).toEqual({
      kind: "cancelled",
      message: "Sign-in was cancelled. Nothing was changed.",
    });
    expect(classifyOAuthCallbackQuery({ error: "user_cancelled" })?.kind).toBe(
      "cancelled",
    );
    expect(classifyOAuthCallbackQuery({})).toBeNull();
    expect(classifyOAuthCallbackQuery({ error: "server_error" })?.kind).toBe(
      "provider",
    );
  });

  it("maps Auth.js error codes onto shopper copy", () => {
    expect(customerOAuthErrorKey(undefined)).toBeNull();
    expect(customerOAuthErrorKey("AccessDenied")).toBe(
      "errorOAuthAccessDenied",
    );
    expect(customerOAuthErrorKey("OAuthAccountNotLinked")).toBe(
      "errorOAuthNotLinked",
    );
    expect(customerOAuthErrorKey("access_denied")).toBe("errorOAuthCancelled");
    expect(customerOAuthErrorKey("OAuthCallbackError")).toBe(
      "errorOAuthGeneric",
    );
  });

  it("sanitizes provider errors and reads Graph messages", () => {
    const token = "EAA" + "B".repeat(40);
    expect(sanitizeProviderMessage(`bad ${token}`)).toContain("[redacted]");
    expect(sanitizeProviderMessage(`bad ${token}`)).not.toContain(token);
    expect(
      graphErrorMessage({ error: { message: "Invalid code", code: 100 } }),
    ).toBe("Invalid code");
    expect(graphErrorMessage({ error_message: "No email" })).toBe("No email");
    expect(graphErrorMessage({ error: { code: "access_token_invalid" } })).toBe(
      "access_token_invalid",
    );
    expect(graphErrorMessage(null)).toBeNull();
    const error = new SocialProviderError("tiktok", "nope", "invalid_profile");
    expect(error.provider).toBe("tiktok");
    expect(error.kind).toBe("invalid_profile");
    expect(error.name).toBe("SocialProviderError");
  });
});
