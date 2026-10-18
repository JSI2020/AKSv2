import { describe, expect, it } from "vitest";

import {
  emailFromOAuthProfile,
  oauthSessionUserLinkable,
  stuckOAuthAccountAction,
} from "./oauth-guard";

describe("oauth session linking", () => {
  it("links only an active customer", () => {
    expect(
      oauthSessionUserLinkable({
        role: "CUSTOMER",
        status: "ACTIVE",
        deletedAt: null,
      }),
    ).toBe(true);
    expect(
      oauthSessionUserLinkable({
        role: "CUSTOMER",
        status: "DISABLED",
        deletedAt: null,
      }),
    ).toBe(false);
    expect(
      oauthSessionUserLinkable({
        role: "OWNER",
        status: "ACTIVE",
        deletedAt: null,
      }),
    ).toBe(false);
    expect(
      oauthSessionUserLinkable({
        role: "CUSTOMER",
        status: "ACTIVE",
        deletedAt: new Date(),
      }),
    ).toBe(false);
  });

  it("releases a provider stuck on a disabled account and keeps a live customer", () => {
    expect(
      stuckOAuthAccountAction({
        role: "CUSTOMER",
        status: "DISABLED",
        deletedAt: null,
      }),
    ).toBe("release");
    expect(
      stuckOAuthAccountAction({
        role: "CUSTOMER",
        status: "ACTIVE",
        deletedAt: new Date(),
      }),
    ).toBe("release");
    expect(
      stuckOAuthAccountAction({
        role: "CUSTOMER",
        status: "ACTIVE",
        deletedAt: null,
      }),
    ).toBe("keep");
    expect(
      stuckOAuthAccountAction({
        role: "ADMIN",
        status: "ACTIVE",
        deletedAt: null,
      }),
    ).toBe("refuse");
    expect(stuckOAuthAccountAction(null)).toBe("keep");
  });

  it("reads the provider profile email and ignores a linked account email", () => {
    expect(emailFromOAuthProfile({ email: " Shopper@gmail.com " })).toBe(
      "Shopper@gmail.com",
    );
    expect(emailFromOAuthProfile({ email: "" })).toBeNull();
    expect(emailFromOAuthProfile(null)).toBeNull();
  });
});
