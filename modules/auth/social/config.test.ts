import { describe, expect, it } from "vitest";

import {
  facebookLoginScopes,
  instagramLoginScopes,
  metaGraphVersion,
  readFacebookCredentials,
  readGoogleCredentials,
  readInstagramCredentials,
  readTikTokCredentials,
  socialCallbackPath,
  tikTokScopes,
  whatsappLoginConfigured,
} from "./config";

const empty = {} as NodeJS.ProcessEnv;

describe("social auth config", () => {
  it("requires both halves of a credential pair", () => {
    expect(readFacebookCredentials(empty)).toBeNull();
    expect(
      readFacebookCredentials({
        AUTH_FACEBOOK_ID: " app ",
        AUTH_FACEBOOK_SECRET: " ",
      }),
    ).toBeNull();
    expect(
      readFacebookCredentials({
        AUTH_FACEBOOK_ID: "fb-app",
        AUTH_FACEBOOK_SECRET: "fb-secret",
      }),
    ).toEqual({ clientId: "fb-app", clientSecret: "fb-secret" });
    expect(
      readGoogleCredentials({ AUTH_GOOGLE_ID: "g", AUTH_GOOGLE_SECRET: "s" }),
    ).toEqual({ clientId: "g", clientSecret: "s" });
    expect(
      readInstagramCredentials({
        AUTH_INSTAGRAM_ID: "ig",
        AUTH_INSTAGRAM_SECRET: "sec",
      }),
    ).toEqual({ clientId: "ig", clientSecret: "sec" });
    expect(
      readTikTokCredentials({
        AUTH_TIKTOK_CLIENT_KEY: "key",
        AUTH_TIKTOK_CLIENT_SECRET: "sec",
      }),
    ).toEqual({ clientId: "key", clientSecret: "sec" });
  });

  it("falls back when a graph version or scope list is unusable", () => {
    expect(metaGraphVersion(empty)).toBe("v21.0");
    expect(metaGraphVersion({ AUTH_META_GRAPH_VERSION: "v22.0" })).toBe(
      "v22.0",
    );
    expect(metaGraphVersion({ AUTH_META_GRAPH_VERSION: "latest" })).toBe(
      "v21.0",
    );
    expect(facebookLoginScopes(empty)).toBe("email,public_profile");
    expect(instagramLoginScopes({ AUTH_INSTAGRAM_SCOPES: "bad scope!" })).toBe(
      "instagram_business_basic",
    );
    expect(
      tikTokScopes({ AUTH_TIKTOK_SCOPES: "user.info.basic user.info.email" }),
    ).toBe("user.info.basic,user.info.email");
  });

  it("enables WhatsApp only when the flag and Cloud API credentials are set", () => {
    expect(whatsappLoginConfigured(empty)).toBe(false);
    expect(
      whatsappLoginConfigured({
        AKS_WHATSAPP_LOGIN: "1",
        WHATSAPP_ACCESS_TOKEN: "token",
        WHATSAPP_PHONE_NUMBER_ID: "  ",
      }),
    ).toBe(false);
    expect(
      whatsappLoginConfigured({
        AKS_WHATSAPP_LOGIN: "1",
        WHATSAPP_ACCESS_TOKEN: "token",
        WHATSAPP_PHONE_NUMBER_ID: "123",
      }),
    ).toBe(true);
  });

  it("publishes the Auth.js callback paths", () => {
    expect(socialCallbackPath("facebook")).toBe("/api/auth/callback/facebook");
    expect(socialCallbackPath("instagram")).toBe(
      "/api/auth/callback/instagram",
    );
    expect(socialCallbackPath("tiktok")).toBe("/api/auth/callback/tiktok");
    expect(socialCallbackPath("google")).toBe("/api/auth/callback/google");
  });
});
