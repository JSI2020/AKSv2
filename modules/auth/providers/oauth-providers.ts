import { customFetch } from "@auth/core";
import type { Provider } from "next-auth/providers";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

import {
  facebookLoginScopes,
  instagramLoginScopes,
  metaGraphVersion,
  readFacebookCredentials,
  readGoogleCredentials,
  readInstagramCredentials,
  readTikTokCredentials,
  tikTokScopes,
} from "@/modules/auth/social/config";
import {
  facebookEndpoints,
  fetchFacebookProfile,
  mapFacebookProfile,
  type FacebookProfile,
} from "@/modules/auth/social/facebook";
import {
  INSTAGRAM_TOKEN_URL,
  conformInstagramTokenResponse,
  fetchInstagramProfile,
  instagramEndpoints,
  mapInstagramProfile,
  prepareInstagramTokenBody,
  type InstagramProfile,
} from "@/modules/auth/social/instagram";
import {
  TIKTOK_TOKEN_URL,
  conformTikTokTokenResponse,
  fetchTikTokProfile,
  mapTikTokProfile,
  rewriteTikTokTokenBody,
  tikTokEndpoints,
  type TikTokProfile,
} from "@/modules/auth/social/tiktok";

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function formBody(body: BodyInit | null | undefined): URLSearchParams | null {
  if (!body) return null;
  if (typeof body === "string") return new URLSearchParams(body);
  if (body instanceof URLSearchParams) return new URLSearchParams(body);
  return null;
}

/**
 * Instagram's code grant is not PKCE. Strip the trailing `#_` Meta appends
 * to authorization codes before the token POST leaves the server.
 */
const instagramAuthFetch: typeof fetch = async (input, init) => {
  const url = requestUrl(input);
  const posted = formBody(init?.body);
  if (url.startsWith(INSTAGRAM_TOKEN_URL) && posted) {
    return fetch(input, { ...init, body: prepareInstagramTokenBody(posted) });
  }
  return fetch(input, init);
};

/** TikTok's token endpoint expects `client_key`, not OAuth's `client_id`. */
const tikTokAuthFetch: typeof fetch = async (input, init) => {
  const url = requestUrl(input);
  const posted = formBody(init?.body);
  if (url.startsWith(TIKTOK_TOKEN_URL) && posted) {
    return fetch(input, { ...init, body: rewriteTikTokTokenBody(posted) });
  }
  return fetch(input, init);
};

/**
 * Storefront OAuth providers. Each one is registered only when both of its
 * credentials are set, so a missing app id never renders a broken button.
 * WhatsApp is intentionally absent: shoppers verify a phone number, they do
 * not complete an OAuth handshake. See `handleWhatsappOtpRequest`.
 */
export function configuredOAuthProviders(
  env: NodeJS.ProcessEnv = process.env,
): Provider[] {
  const list: Provider[] = [];
  const version = metaGraphVersion(env);
  const facebookUrls = facebookEndpoints(version);
  const instagramUrls = instagramEndpoints(version);
  const tiktokScopes = tikTokScopes(env);
  const tiktokUrls = tikTokEndpoints(tiktokScopes);

  const google = readGoogleCredentials(env);
  if (google) {
    list.push(
      Google({
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  const facebook = readFacebookCredentials(env);
  if (facebook) {
    list.push(
      Facebook({
        clientId: facebook.clientId,
        clientSecret: facebook.clientSecret,
        allowDangerousEmailAccountLinking: true,
        checks: ["pkce", "state"],
        client: { token_endpoint_auth_method: "client_secret_post" },
        authorization: {
          url: facebookUrls.authorize,
          params: { scope: facebookLoginScopes(env) },
        },
        token: facebookUrls.token,
        userinfo: {
          url: facebookUrls.userinfo,
          async request({ tokens }: { tokens: { access_token?: string } }) {
            const accessToken = tokens.access_token;
            if (!accessToken) {
              throw new Error("Missing Facebook access token.");
            }
            return fetchFacebookProfile({ accessToken, version });
          },
        },
        profile(profile) {
          return mapFacebookProfile(profile as FacebookProfile);
        },
      }),
    );
  }

  const instagram = readInstagramCredentials(env);
  if (instagram) {
    list.push({
      id: "instagram",
      name: "Instagram",
      type: "oauth",
      clientId: instagram.clientId,
      clientSecret: instagram.clientSecret,
      allowDangerousEmailAccountLinking: true,
      // State only. Instagram Login does not specify PKCE, and a code_verifier
      // on the token POST is rejected by Meta.
      checks: ["state"],
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: {
        url: instagramUrls.authorize,
        params: { scope: instagramLoginScopes(env) },
      },
      token: {
        url: instagramUrls.token,
        conform: conformInstagramTokenResponse,
      },
      userinfo: {
        url: instagramUrls.userinfo,
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const accessToken = tokens.access_token;
          if (!accessToken) {
            throw new Error("Missing Instagram access token.");
          }
          return fetchInstagramProfile({ accessToken, version });
        },
      },
      profile(profile: InstagramProfile) {
        return mapInstagramProfile(profile);
      },
      options: {
        clientId: instagram.clientId,
        clientSecret: instagram.clientSecret,
        [customFetch]: instagramAuthFetch,
      },
    });
  }

  const tiktok = readTikTokCredentials(env);
  if (tiktok) {
    list.push({
      id: "tiktok",
      name: "TikTok",
      type: "oauth",
      clientId: tiktok.clientId,
      clientSecret: tiktok.clientSecret,
      allowDangerousEmailAccountLinking: true,
      // State only. Web Login Kit does not use PKCE; code_verifier on the
      // token POST is rejected (Auth.js then reports error=Configuration).
      checks: ["state"],
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: {
        url: tiktokUrls.authorize,
        params: {
          client_key: tiktok.clientId,
          scope: tiktokScopes,
        },
      },
      token: {
        url: tiktokUrls.token,
        conform: conformTikTokTokenResponse,
      },
      userinfo: {
        url: tiktokUrls.userinfo,
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const accessToken = tokens.access_token;
          if (!accessToken) {
            throw new Error("Missing TikTok access token.");
          }
          return fetchTikTokProfile({ accessToken, scopes: tiktokScopes });
        },
      },
      profile(profile: TikTokProfile) {
        return mapTikTokProfile(profile);
      },
      options: {
        clientId: tiktok.clientId,
        clientSecret: tiktok.clientSecret,
        [customFetch]: tikTokAuthFetch,
      },
    });
  }

  return list;
}
