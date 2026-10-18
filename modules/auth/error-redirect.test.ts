import { describe, expect, it } from "vitest";

import { PUBLIC_SITE_ORIGIN } from "@/modules/legal/routes";

import { authErrorRedirectUrl } from "./error-redirect";

describe("auth error redirect", () => {
  it("sends shop OAuth errors to the public account login, not the bind address", () => {
    const url = authErrorRedirectUrl("AccessDenied", PUBLIC_SITE_ORIGIN);
    expect(url.origin).toBe("https://www.aks-atelier.com");
    expect(url.pathname).toBe("/account/login");
    expect(url.searchParams.get("error")).toBe("AccessDenied");

    const tiktok = authErrorRedirectUrl("Configuration", PUBLIC_SITE_ORIGIN);
    expect(tiktok.hostname).toBe("www.aks-atelier.com");
    expect(tiktok.searchParams.get("error")).toBe("Configuration");
  });

  it("keeps staff credential errors on the admin login", () => {
    const url = authErrorRedirectUrl("CredentialsSignin", PUBLIC_SITE_ORIGIN);
    expect(url.pathname).toBe("/admin/login");
  });
});