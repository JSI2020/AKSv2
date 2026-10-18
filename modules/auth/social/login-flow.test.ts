import { describe, expect, it, vi } from "vitest";

import { HOUSE_PLACEHOLDER_DOMAIN } from "./identity";
import { resumeSocialLogin } from "./login-flow";

const credentials = { clientId: "app-id", clientSecret: "app-secret" };
const redirectUri = "http://localhost:3000/api/auth/callback/facebook";

function routingFetch(
  handlers: Record<string, (init?: RequestInit) => Response>,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const match = Object.keys(handlers).find((key) => url.startsWith(key));
    if (!match) {
      return new Response(
        JSON.stringify({ error: { message: `unmocked ${url}` } }),
        {
          status: 500,
        },
      );
    }
    return handlers[match]!(init);
  });
}

describe("resumeSocialLogin", () => {
  it("stops a cancelled consent before calling the provider", async () => {
    const fetchImpl = vi.fn();
    const result = await resumeSocialLogin({
      provider: "facebook",
      query: { error: "access_denied", error_reason: "user_denied" },
      redirectUri,
      credentials,
      fetchImpl,
    });
    expect(result).toMatchObject({ ok: false, kind: "cancelled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses to start when credentials are missing", async () => {
    const result = await resumeSocialLogin({
      provider: "instagram",
      query: { code: "abc" },
      redirectUri,
      credentials: null,
    });
    expect(result).toMatchObject({ ok: false, kind: "misconfigured" });
  });

  it("exchanges a Facebook code and keeps a real email", async () => {
    const fetchImpl = routingFetch({
      "https://graph.facebook.com/": (init) => {
        if (init?.method === "POST") {
          const body = String(init.body);
          expect(body).toContain("client_id=app-id");
          expect(body).toContain("client_secret=app-secret");
          expect(body).toContain("code=fb-code");
          return new Response(
            JSON.stringify({ access_token: "fb-token", token_type: "bearer" }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            id: "55",
            name: "Amina",
            email: "amina@example.com",
          }),
          { status: 200 },
        );
      },
    });
    const result = await resumeSocialLogin({
      provider: "facebook",
      query: { code: "fb-code" },
      redirectUri,
      credentials,
      env: { AUTH_META_GRAPH_VERSION: "v21.0" },
      fetchImpl,
    });
    expect(result).toEqual({
      ok: true,
      provider: "facebook",
      profile: {
        id: "55",
        email: "amina@example.com",
        name: "Amina",
        image: null,
      },
    });
  });

  it("exchanges an Instagram code, strips #_, and stores a placeholder email", async () => {
    const fetchImpl = routingFetch({
      "https://api.instagram.com/oauth/access_token": (init) => {
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("code")).toBe("ig-code");
        expect(body.get("client_secret")).toBe("app-secret");
        return new Response(
          JSON.stringify({
            data: [{ access_token: "ig-token", user_id: "1784" }],
          }),
          { status: 200 },
        );
      },
      "https://graph.instagram.com/": () =>
        new Response(
          JSON.stringify({
            user_id: "1784",
            username: "house",
            account_type: "BUSINESS",
          }),
          { status: 200 },
        ),
    });
    const result = await resumeSocialLogin({
      provider: "instagram",
      query: { code: "ig-code#_" },
      redirectUri: "http://localhost:3000/api/auth/callback/instagram",
      credentials,
      env: { AUTH_META_GRAPH_VERSION: "v21.0" },
      fetchImpl,
    });
    expect(result).toMatchObject({
      ok: true,
      provider: "instagram",
      profile: {
        id: "1784",
        email: `ig.1784${HOUSE_PLACEHOLDER_DOMAIN}`,
        name: "house",
      },
    });
  });

  it("posts TikTok's client_key and PKCE verifier, then reads the nested user", async () => {
    const fetchImpl = routingFetch({
      "https://open.tiktokapis.com/v2/oauth/token": (init) => {
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("client_key")).toBe("app-id");
        expect(body.get("client_id")).toBeNull();
        expect(body.get("code_verifier")).toBe("verifier");
        return new Response(
          JSON.stringify({
            access_token: "tt-token",
            token_type: "Bearer",
            open_id: "open-1",
          }),
          { status: 200 },
        );
      },
      "https://open.tiktokapis.com/v2/user/info": () =>
        new Response(
          JSON.stringify({
            data: { user: { open_id: "open-1", display_name: "Amina" } },
            error: { code: "ok", message: "" },
          }),
          { status: 200 },
        ),
    });
    const result = await resumeSocialLogin({
      provider: "tiktok",
      query: { code: "tt-code" },
      redirectUri: "http://localhost:3000/api/auth/callback/tiktok",
      credentials,
      codeVerifier: "verifier",
      env: {},
      fetchImpl,
    });
    expect(result).toMatchObject({
      ok: true,
      provider: "tiktok",
      profile: {
        id: "open-1",
        name: "Amina",
        email: `tt.open-1${HOUSE_PLACEHOLDER_DOMAIN}`,
      },
    });
  });

  it("turns a provider token error into a shopper-safe failure", async () => {
    const fetchImpl = routingFetch({
      "https://graph.facebook.com/": () =>
        new Response(
          JSON.stringify({ error: { message: "code expired", code: 100 } }),
          {
            status: 400,
          },
        ),
    });
    const result = await resumeSocialLogin({
      provider: "facebook",
      query: { code: "used" },
      redirectUri,
      credentials,
      env: { AUTH_META_GRAPH_VERSION: "v21.0" },
      fetchImpl,
    });
    expect(result).toEqual({
      ok: false,
      kind: "provider",
      message: "That sign-in didn't finish. Try again, or use an email code.",
    });
  });

  it("fails when the callback has no code and no error", async () => {
    const result = await resumeSocialLogin({
      provider: "tiktok",
      query: {},
      redirectUri,
      credentials,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("provider");
  });
});
