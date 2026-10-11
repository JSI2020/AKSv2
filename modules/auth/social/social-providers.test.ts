import { afterEach, describe, expect, it } from "vitest";

import {
  configuredSocialProviders,
  storefrontAuthChannels,
  whatsappLoginEnabled,
} from "../social-providers";

const KEYS = [
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_FACEBOOK_ID",
  "AUTH_FACEBOOK_SECRET",
  "AUTH_INSTAGRAM_ID",
  "AUTH_INSTAGRAM_SECRET",
  "AUTH_TIKTOK_CLIENT_KEY",
  "AUTH_TIKTOK_CLIENT_SECRET",
  "AKS_WHATSAPP_LOGIN",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
] as const;

describe("storefront auth channels", () => {
  const previous = Object.fromEntries(
    KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("keeps every house channel on Soon when nothing is configured", () => {
    for (const key of KEYS) delete process.env[key];
    expect(configuredSocialProviders()).toEqual([]);
    expect(whatsappLoginEnabled()).toBe(false);
    expect(storefrontAuthChannels()).toEqual([
      { key: "whatsapp", status: "soon" },
      { key: "facebook", status: "soon" },
      { key: "instagram", status: "soon" },
      { key: "tiktok", status: "soon" },
    ]);
  });

  it("marks a provider live only after both of its credentials are present", () => {
    for (const key of KEYS) delete process.env[key];
    process.env.AUTH_FACEBOOK_ID = "fb";
    process.env.AUTH_FACEBOOK_SECRET = "sec";
    process.env.AUTH_INSTAGRAM_ID = "ig";
    process.env.AUTH_INSTAGRAM_SECRET = "sec";
    process.env.AUTH_TIKTOK_CLIENT_KEY = "key";
    process.env.AUTH_TIKTOK_CLIENT_SECRET = "sec";
    process.env.AUTH_GOOGLE_ID = "g";
    process.env.AUTH_GOOGLE_SECRET = "sec";
    process.env.AKS_WHATSAPP_LOGIN = "1";
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";

    expect(configuredSocialProviders()).toEqual([
      "google",
      "facebook",
      "instagram",
      "tiktok",
    ]);
    expect(
      storefrontAuthChannels().every((channel) => channel.status === "live"),
    ).toBe(true);
  });
});
