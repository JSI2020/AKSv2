import { describe, expect, it, vi } from "vitest";

import { HOUSE_PLACEHOLDER_DOMAIN } from "./identity";
import {
  conformTikTokTokenResponse,
  fetchTikTokProfile,
  mapTikTokProfile,
  parseTikTokProfile,
  rewriteTikTokTokenBody,
  tikTokEndpoints,
  tikTokUserFields,
} from "./tiktok";

describe("TikTok Login Kit", () => {
  it("requests PKCE fields and adds email only when that scope is on", () => {
    const urls = tikTokEndpoints("user.info.basic,user.info.profile");
    expect(urls.authorize).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(urls.token).toBe("https://open.tiktokapis.com/v2/oauth/token/");
    expect(urls.userinfo).toContain("fields=open_id");
    expect(urls.userinfo).not.toContain("email");
    expect(tikTokUserFields("user.info.basic,user.info.email")).toContain(
      "email",
    );
  });

  it("renames client_id to client_key and drops PKCE for the web token exchange", () => {
    const body = rewriteTikTokTokenBody(
      new URLSearchParams({
        client_id: "key-1",
        client_secret: "secret-1",
        code: "c",
        code_verifier: "verifier",
        grant_type: "authorization_code",
      }),
    );
    expect(body.get("client_key")).toBe("key-1");
    expect(body.get("client_id")).toBeNull();
    expect(body.get("client_secret")).toBe("secret-1");
    expect(body.get("code_verifier")).toBeNull();
  });

  it("normalizes a token response and turns provider errors into OAuth errors", async () => {
    const ok = await conformTikTokTokenResponse(
      new Response(
        JSON.stringify({
          access_token: "tt",
          expires_in: 86400,
          open_id: "open-1",
          token_type: "Bearer",
        }),
        { status: 200 },
      ),
    );
    await expect(ok.json()).resolves.toMatchObject({
      access_token: "tt",
      token_type: "bearer",
      expires_in: 86400,
    });

    const emptyError = await conformTikTokTokenResponse(
      new Response(
        JSON.stringify({
          access_token: "tt-2",
          token_type: "Bearer",
          error: "",
          error_description: "",
        }),
        { status: 200 },
      ),
    );
    expect(emptyError.status).toBe(200);
    await expect(emptyError.json()).resolves.toMatchObject({
      access_token: "tt-2",
      token_type: "bearer",
    });

    const nested = await conformTikTokTokenResponse(
      new Response(
        JSON.stringify({
          data: { access_token: "tt-3", expires_in: 3600 },
          error: { code: "ok", message: "" },
        }),
        { status: 200 },
      ),
    );
    expect(nested.status).toBe(200);
    await expect(nested.json()).resolves.toMatchObject({
      access_token: "tt-3",
      token_type: "bearer",
    });

    const cancelled = await conformTikTokTokenResponse(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "code expired",
        }),
        { status: 200 },
      ),
    );
    expect(cancelled.status).toBe(400);
    await expect(cancelled.json()).resolves.toMatchObject({
      error: "invalid_grant",
      error_description: "code expired",
    });
  });

  it("reads the nested user and keeps a real email when TikTok shares one", () => {
    const profile = parseTikTokProfile({
      data: {
        user: {
          open_id: "open-9",
          union_id: "union-9",
          display_name: "Amina",
          username: "amina",
          avatar_url: "https://cdn.example/tt.jpg",
          email: "amina@example.com",
        },
      },
      error: { code: "ok", message: "" },
    });
    expect(mapTikTokProfile(profile)).toEqual({
      id: "open-9",
      name: "Amina",
      email: "amina@example.com",
      image: "https://cdn.example/tt.jpg",
    });
    expect(profile.unionId).toBe("union-9");
  });

  it("falls back to a placeholder when there is no email", () => {
    const profile = parseTikTokProfile({
      data: { user: { open_id: "open-2", display_name: "Guest" } },
      error: { code: "ok", message: "" },
    });
    expect(mapTikTokProfile(profile).email).toBe(
      `tt.open-2${HOUSE_PLACEHOLDER_DOMAIN}`,
    );
  });

  it("loads user info with a bearer token and rejects TikTok error codes", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: { user: { open_id: "o", display_name: "N" } },
            error: { code: "ok", message: "" },
          }),
          { status: 200 },
        ),
    );
    const profile = await fetchTikTokProfile({
      accessToken: "tt-token",
      scopes: "user.info.basic,user.info.profile",
      fetchImpl,
    });
    expect(profile.id).toBe("o");
    expect((fetchImpl.mock.calls[0]![1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tt-token",
    });

    const failing = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {},
            error: { code: "access_token_invalid", message: "token rejected" },
          }),
          { status: 200 },
        ),
    );
    await expect(
      fetchTikTokProfile({ accessToken: "bad", fetchImpl: failing }),
    ).rejects.toThrow(/token rejected/);
  });
});
