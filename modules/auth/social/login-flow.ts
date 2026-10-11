import type { OAuthCredentials, SocialOAuthProvider } from "./config";
import { metaGraphVersion, tikTokScopes } from "./config";
import { SocialProviderError } from "./errors";
import {
  fetchFacebookProfile,
  facebookEndpoints,
  mapFacebookProfile,
} from "./facebook";
import { providerFetchInit, readJsonBody, throwIfProviderFailed } from "./http";
import {
  fetchInstagramProfile,
  instagramEndpoints,
  mapInstagramProfile,
  prepareInstagramTokenBody,
} from "./instagram";
import { classifyOAuthCallbackQuery } from "./oauth-errors";
import {
  fetchTikTokProfile,
  mapTikTokProfile,
  rewriteTikTokTokenBody,
  tikTokEndpoints,
} from "./tiktok";

export type SocialLoginProfile = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

export type SocialLoginResult =
  | { ok: true; provider: SocialOAuthProvider; profile: SocialLoginProfile }
  | {
      ok: false;
      kind:
        | "cancelled"
        | "denied"
        | "misconfigured"
        | "provider"
        | "invalid_profile";
      message: string;
    };

const SHOPPER_PROVIDER_MESSAGE =
  "That sign-in didn't finish. Try again, or use an email code.";

function formBody(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

/**
 * Application-level OAuth code grant for Facebook, Instagram, and TikTok.
 * Auth.js performs the same requests in production (state and PKCE included).
 * Tests call this with a mocked `fetch` so the provider HTTP contract is
 * locked without live app credentials.
 */
export async function resumeSocialLogin(input: {
  provider: SocialOAuthProvider;
  query: {
    error?: string | null;
    error_reason?: string | null;
    error_description?: string | null;
    code?: string | null;
  };
  redirectUri: string;
  credentials: OAuthCredentials | null;
  codeVerifier?: string | null;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<SocialLoginResult> {
  const cancelled = classifyOAuthCallbackQuery(input.query);
  if (cancelled)
    return { ok: false, kind: cancelled.kind, message: cancelled.message };

  if (!input.credentials) {
    return {
      ok: false,
      kind: "misconfigured",
      message: "That sign-in method is not available.",
    };
  }

  const code = input.query.code?.trim() ?? "";
  if (!code) {
    return { ok: false, kind: "provider", message: SHOPPER_PROVIDER_MESSAGE };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const env = input.env ?? process.env;

  try {
    const accessToken = await exchangeCode({
      provider: input.provider,
      code,
      redirectUri: input.redirectUri,
      credentials: input.credentials,
      codeVerifier: input.codeVerifier,
      fetchImpl,
      env,
    });
    const profile = await loadProfile({
      provider: input.provider,
      accessToken,
      fetchImpl,
      env,
    });
    return { ok: true, provider: input.provider, profile };
  } catch (error) {
    if (error instanceof SocialProviderError) {
      return {
        ok: false,
        kind: error.kind === "invalid_profile" ? "invalid_profile" : "provider",
        message: SHOPPER_PROVIDER_MESSAGE,
      };
    }
    return { ok: false, kind: "provider", message: SHOPPER_PROVIDER_MESSAGE };
  }
}

async function exchangeCode(input: {
  provider: SocialOAuthProvider;
  code: string;
  redirectUri: string;
  credentials: OAuthCredentials;
  codeVerifier?: string | null;
  fetchImpl: typeof fetch;
  env: NodeJS.ProcessEnv;
}): Promise<string> {
  const body = formBody({
    client_id: input.credentials.clientId,
    client_secret: input.credentials.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
    grant_type: "authorization_code",
    ...(input.codeVerifier ? { code_verifier: input.codeVerifier } : {}),
  });

  let tokenUrl: string;
  let posted: URLSearchParams;
  if (input.provider === "facebook") {
    tokenUrl = facebookEndpoints(metaGraphVersion(input.env)).token;
    posted = body;
  } else if (input.provider === "instagram") {
    tokenUrl = instagramEndpoints().token;
    posted = prepareInstagramTokenBody(body);
  } else {
    tokenUrl = tikTokEndpoints(tikTokScopes(input.env)).token;
    posted = rewriteTikTokTokenBody(body);
    if (input.codeVerifier && !posted.get("code_verifier")) {
      posted.set("code_verifier", input.codeVerifier);
    }
  }

  const response = await input.fetchImpl(
    tokenUrl,
    providerFetchInit({
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: posted,
    }),
  );
  const json = await readJsonBody(response);
  throwIfProviderFailed({ provider: input.provider, response, body: json });

  const record = unwrapToken(input.provider, json);
  const accessToken =
    record && typeof record.access_token === "string"
      ? record.access_token.trim()
      : "";
  if (!accessToken) {
    throw new SocialProviderError(
      input.provider,
      "Provider did not return an access token.",
    );
  }
  return accessToken;
}

function unwrapToken(
  provider: SocialOAuthProvider,
  body: unknown,
): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  if (provider !== "instagram") return body as Record<string, unknown>;
  const data = (body as { data?: unknown }).data;
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  return body as Record<string, unknown>;
}

async function loadProfile(input: {
  provider: SocialOAuthProvider;
  accessToken: string;
  fetchImpl: typeof fetch;
  env: NodeJS.ProcessEnv;
}): Promise<SocialLoginProfile> {
  if (input.provider === "facebook") {
    const profile = await fetchFacebookProfile({
      accessToken: input.accessToken,
      version: metaGraphVersion(input.env),
      fetchImpl: input.fetchImpl,
    });
    return mapFacebookProfile(profile);
  }
  if (input.provider === "instagram") {
    const profile = await fetchInstagramProfile({
      accessToken: input.accessToken,
      version: metaGraphVersion(input.env),
      fetchImpl: input.fetchImpl,
    });
    return mapInstagramProfile(profile);
  }
  const profile = await fetchTikTokProfile({
    accessToken: input.accessToken,
    scopes: tikTokScopes(input.env),
    fetchImpl: input.fetchImpl,
  });
  return mapTikTokProfile(profile);
}
