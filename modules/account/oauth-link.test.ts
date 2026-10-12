import { describe, expect, it } from "vitest";

import {
  oauthLinkDecision,
  readOAuthLinkCookie,
  signOAuthLinkCookie,
} from "./oauth-link";

const owner = {
  id: "user-1",
  role: "CUSTOMER",
  status: "ACTIVE",
  deletedAt: null,
  email: "you@example.com",
};

describe("oauth link cookie", () => {
  it("round-trips and rejects a tampered or expired cookie", () => {
    const now = 1_700_000_000_000;
    const value = signOAuthLinkCookie("user-1", "secret", now + 1000);
    expect(readOAuthLinkCookie(value, "secret", now)).toBe("user-1");
    expect(readOAuthLinkCookie(value, "other", now)).toBeNull();
    expect(readOAuthLinkCookie(value, "secret", now + 5000)).toBeNull();
    expect(readOAuthLinkCookie(`${value}x`, "secret", now)).toBeNull();
  });

  it("attaches only a live customer, and refuses a taken provider", () => {
    expect(
      oauthLinkDecision({
        linkUserId: null,
        owner: null,
        existingAccountUserId: null,
      }),
    ).toBe("continue");
    expect(
      oauthLinkDecision({
        linkUserId: "user-1",
        owner,
        existingAccountUserId: null,
      }),
    ).toBe("attach");
    expect(
      oauthLinkDecision({
        linkUserId: "user-1",
        owner: { ...owner, role: "ADMIN" },
        existingAccountUserId: null,
      }),
    ).toBe("refuse");
    expect(
      oauthLinkDecision({
        linkUserId: "user-1",
        owner,
        existingAccountUserId: "someone-else",
      }),
    ).toBe("refuse");
  });
});
