import { describe, expect, it, vi } from "vitest";

import {
  conformInstagramTokenResponse,
  fetchInstagramProfile,
  instagramAuthorizeParams,
  instagramEndpoints,
  mapInstagramProfile,
  normalizeInstagramTokenPayload,
  parseInstagramProfile,
  prepareInstagramTokenBody,
} from "./instagram";
import { HOUSE_PLACEHOLDER_DOMAIN } from "./identity";

describe("Instagram Login", () => {
  it("points at Instagram's official authorize and token URLs", () => {
    const urls = instagramEndpoints("v21.0");
    expect(urls.authorize).toBe("https://www.instagram.com/oauth/authorize");
    expect(urls.token).toBe("https://api.instagram.com/oauth/access_token");
    expect(urls.userinfo).toContain("graph.instagram.com/v21.0/me");
    expect(instagramAuthorizeParams({ AUTH_INSTAGRAM_SCOPES: "" })).toEqual({
      scope: "instagram_business_basic",
    });
  });

  it("strips the #_ suffix Meta appends to authorization codes", () => {
    const body = prepareInstagramTokenBody(
      new URLSearchParams({ code: "abc#_", client_id: "id" }),
    );
    expect(body.get("code")).toBe("abc");
    expect(body.get("client_id")).toBe("id");
  });

  it("normalizes both token response shapes into a bearer token", () => {
    expect(
      normalizeInstagramTokenPayload({
        data: [
          {
            access_token: "short",
            user_id: 1784,
            permissions: "instagram_business_basic",
          },
        ],
      }),
    ).toEqual({
      ok: true,
      token: { access_token: "short", token_type: "bearer", user_id: "1784" },
    });
    expect(
      normalizeInstagramTokenPayload({
        access_token: "flat",
        user_id: "9",
        expires_in: 3600,
      }),
    ).toMatchObject({
      ok: true,
      token: { access_token: "flat", expires_in: 3600 },
    });
    expect(
      normalizeInstagramTokenPayload({ error_message: "code used" }).ok,
    ).toBe(false);
  });

  it("rewrites a non-conform token response for Auth.js", async () => {
    const response = await conformInstagramTokenResponse(
      new Response(
        JSON.stringify({ data: [{ access_token: "t", user_id: "5" }] }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      access_token: "t",
      token_type: "bearer",
      user_id: "5",
    });

    const failed = await conformInstagramTokenResponse(
      new Response(JSON.stringify({ error_message: "nope" }), { status: 400 }),
    );
    expect(failed.status).toBe(400);
    await expect(failed.json()).resolves.toMatchObject({
      error: "invalid_grant",
    });
  });

  it("maps a professional profile onto a placeholder email", () => {
    const profile = parseInstagramProfile({
      user_id: "178414",
      username: "amina.studio",
      name: "Amina",
      account_type: "BUSINESS",
      profile_picture_url: "https://cdn.example/ig.jpg",
    });
    expect(mapInstagramProfile(profile)).toEqual({
      id: "178414",
      name: "Amina",
      email: `ig.178414${HOUSE_PLACEHOLDER_DOMAIN}`,
      image: "https://cdn.example/ig.jpg",
    });
    expect(mapInstagramProfile({ ...profile, name: null }).name).toBe(
      "amina.studio",
    );
  });

  it("fetches /me with the access token and fails closed on Graph errors", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ user_id: "3", username: "house" }), {
          status: 200,
        }),
    );
    const profile = await fetchInstagramProfile({
      accessToken: "ig-token",
      version: "v21.0",
      fetchImpl,
    });
    expect(profile.username).toBe("house");
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(
      "access_token=ig-token",
    );

    const failing = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { message: "professional account required", code: 100 },
          }),
          {
            status: 400,
          },
        ),
    );
    await expect(
      fetchInstagramProfile({ accessToken: "x", fetchImpl: failing }),
    ).rejects.toThrow(/professional account required/);
  });
});
