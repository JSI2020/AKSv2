import { customFetch } from "@auth/core";
import { describe, expect, it, vi } from "vitest";

import { configuredOAuthProviders } from "./oauth-providers";

function byId(env: NodeJS.ProcessEnv, id: string) {
  return configuredOAuthProviders(env).find((provider) => {
    return typeof provider !== "function" && provider.id === id;
  });
}

describe("configuredOAuthProviders", () => {
  it("registers nothing when credentials are absent", () => {
    expect(configuredOAuthProviders({})).toEqual([]);
  });

  it("registers each provider from env and never from a hardcoded secret", () => {
    const env = {
      AUTH_GOOGLE_ID: "google-id",
      AUTH_GOOGLE_SECRET: "google-secret",
      AUTH_FACEBOOK_ID: "facebook-id",
      AUTH_FACEBOOK_SECRET: "facebook-secret",
      AUTH_INSTAGRAM_ID: "instagram-id",
      AUTH_INSTAGRAM_SECRET: "instagram-secret",
      AUTH_TIKTOK_CLIENT_KEY: "tiktok-key",
      AUTH_TIKTOK_CLIENT_SECRET: "tiktok-secret",
      AUTH_META_GRAPH_VERSION: "v21.0",
    };
    const ids = configuredOAuthProviders(env).map((provider) =>
      typeof provider === "function" ? "" : provider.id,
    );
    expect(ids).toEqual(["google", "facebook", "instagram", "tiktok"]);

    const facebook = byId(env, "facebook");
    expect(facebook && "options" in facebook && facebook.options).toMatchObject(
      {
        clientId: "facebook-id",
        clientSecret: "facebook-secret",
        allowDangerousEmailAccountLinking: true,
        checks: ["pkce", "state"],
      },
    );
    const facebookOptions =
      facebook && "options" in facebook ? facebook.options : undefined;
    expect(facebookOptions?.authorization).toMatchObject({
      url: "https://www.facebook.com/v21.0/dialog/oauth",
    });

    const instagram = byId(env, "instagram");
    expect(instagram).toMatchObject({
      id: "instagram",
      checks: ["state"],
      allowDangerousEmailAccountLinking: true,
      clientId: "instagram-id",
    });
    expect(
      instagram && "checks" in instagram && instagram.checks,
    ).not.toContain("pkce");

    const tiktok = byId(env, "tiktok");
    expect(tiktok).toMatchObject({
      id: "tiktok",
      checks: ["state"],
      clientId: "tiktok-key",
      authorization: {
        params: {
          client_key: "tiktok-key",
          scope: "user.info.basic,user.info.profile",
        },
      },
    });
  });

  it("rewrites Instagram and TikTok token bodies through customFetch", async () => {
    const env = {
      AUTH_INSTAGRAM_ID: "instagram-id",
      AUTH_INSTAGRAM_SECRET: "instagram-secret",
      AUTH_TIKTOK_CLIENT_KEY: "tiktok-key",
      AUTH_TIKTOK_CLIENT_SECRET: "tiktok-secret",
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));

    const instagram = byId(env, "instagram");
    const instagramFetch =
      instagram && "options" in instagram
        ? (instagram.options as Record<symbol, typeof fetch>)[customFetch]
        : undefined;
    await instagramFetch?.("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({ code: "raw#_", client_id: "instagram-id" }),
    });
    const instagramBody = fetchSpy.mock.calls.at(-1)?.[1]?.body;
    expect(instagramBody).toBeInstanceOf(URLSearchParams);
    expect((instagramBody as URLSearchParams).get("code")).toBe("raw");

    const tiktok = byId(env, "tiktok");
    const tiktokFetch =
      tiktok && "options" in tiktok
        ? (tiktok.options as Record<symbol, typeof fetch>)[customFetch]
        : undefined;
    await tiktokFetch?.("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      body: new URLSearchParams({
        client_id: "tiktok-key",
        code: "c",
        code_verifier: "v",
      }),
    });
    const tiktokBody = fetchSpy.mock.calls.at(-1)?.[1]?.body as URLSearchParams;
    expect(tiktokBody.get("client_key")).toBe("tiktok-key");
    expect(tiktokBody.get("client_id")).toBeNull();
    expect(tiktokBody.get("code_verifier")).toBeNull();

    fetchSpy.mockRestore();
  });
});
