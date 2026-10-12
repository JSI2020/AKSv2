import { instagramLoginScopes, metaGraphVersion } from "./config";
import {
  SocialProviderError,
  graphErrorMessage,
  sanitizeProviderMessage,
} from "./errors";
import { providerFetchInit, readJsonBody, throwIfProviderFailed } from "./http";
import { socialPlaceholderEmail } from "./identity";

export const INSTAGRAM_PROFILE_FIELDS =
  "user_id,username,name,account_type,profile_picture_url";

export const INSTAGRAM_AUTHORIZE_URL =
  "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_TOKEN_URL =
  "https://api.instagram.com/oauth/access_token";

export type InstagramProfile = {
  id: string;
  username: string | null;
  name: string | null;
  image: string | null;
  accountType: string | null;
};

export type NormalizedToken = {
  access_token: string;
  token_type: "bearer";
  expires_in?: number;
  user_id?: string;
};

export function instagramEndpoints(version = metaGraphVersion()) {
  return {
    authorize: INSTAGRAM_AUTHORIZE_URL,
    token: INSTAGRAM_TOKEN_URL,
    userinfo: `https://graph.instagram.com/${version}/me?fields=${INSTAGRAM_PROFILE_FIELDS}`,
  };
}

/** Instagram sometimes appends `#_` to the authorization code. */
export function prepareInstagramTokenBody(
  body: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(body);
  const code = next.get("code");
  if (code?.endsWith("#_")) next.set("code", code.slice(0, -2));
  return next;
}

function asTokenRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const data = record.data;
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  return record;
}

export function normalizeInstagramTokenPayload(
  body: unknown,
):
  | { ok: true; token: NormalizedToken }
  | { ok: false; error: string; error_description: string } {
  const message = graphErrorMessage(body);
  const record = asTokenRecord(body);
  const accessToken =
    record && typeof record.access_token === "string"
      ? record.access_token.trim()
      : "";
  if (!accessToken) {
    return {
      ok: false,
      error: "invalid_grant",
      error_description: sanitizeProviderMessage(
        message ?? "Instagram did not return an access token.",
      ),
    };
  }
  const userId = record?.user_id;
  const expires = record?.expires_in;
  const token: NormalizedToken = {
    access_token: accessToken,
    token_type: "bearer",
    ...(typeof userId === "string" || typeof userId === "number"
      ? { user_id: String(userId) }
      : {}),
    ...(typeof expires === "number" && Number.isFinite(expires)
      ? { expires_in: expires }
      : {}),
  };
  return { ok: true, token };
}

export async function conformInstagramTokenResponse(
  response: Response,
): Promise<Response> {
  const body = await readJsonBody(response);
  const normalized = normalizeInstagramTokenPayload(body);
  if (!normalized.ok || !response.ok) {
    const description = normalized.ok
      ? `HTTP ${response.status}`
      : normalized.error_description;
    return new Response(
      JSON.stringify({
        error: normalized.ok ? "invalid_grant" : normalized.error,
        error_description: description,
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  return new Response(JSON.stringify(normalized.token), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export function parseInstagramProfile(body: unknown): InstagramProfile {
  if (!body || typeof body !== "object") {
    throw new SocialProviderError(
      "instagram",
      "Instagram returned an unreadable profile.",
      "invalid_profile",
    );
  }
  const record = body as {
    user_id?: unknown;
    id?: unknown;
    username?: unknown;
    name?: unknown;
    account_type?: unknown;
    profile_picture_url?: unknown;
  };
  const idSource = record.user_id ?? record.id;
  const id =
    typeof idSource === "string" || typeof idSource === "number"
      ? String(idSource).trim()
      : "";
  if (!id) {
    throw new SocialProviderError(
      "instagram",
      "Instagram did not return an account id.",
      "invalid_profile",
    );
  }
  const username =
    typeof record.username === "string" && record.username.trim()
      ? record.username.trim()
      : null;
  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : null;
  const image =
    typeof record.profile_picture_url === "string" &&
    record.profile_picture_url.trim()
      ? record.profile_picture_url
      : null;
  const accountType =
    typeof record.account_type === "string" && record.account_type.trim()
      ? record.account_type.trim()
      : null;
  return { id, username, name, image, accountType };
}

export function mapInstagramProfile(profile: InstagramProfile): {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
} {
  const email = socialPlaceholderEmail("instagram", profile.id);
  if (!email) {
    throw new SocialProviderError(
      "instagram",
      "Instagram account could not be mapped.",
      "invalid_profile",
    );
  }
  return {
    id: profile.id,
    name: profile.name ?? profile.username,
    email,
    image: profile.image,
  };
}

export async function fetchInstagramProfile(input: {
  accessToken: string;
  version?: string;
  fetchImpl?: typeof fetch;
}): Promise<InstagramProfile> {
  const token = input.accessToken.trim();
  if (!token) {
    throw new SocialProviderError(
      "instagram",
      "Missing Instagram access token.",
    );
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(instagramEndpoints(input.version).userinfo);
  url.searchParams.set("access_token", token);
  const response = await fetchImpl(url, providerFetchInit());
  const body = await readJsonBody(response);
  throwIfProviderFailed({ provider: "instagram", response, body });
  return parseInstagramProfile(body);
}

export function instagramAuthorizeParams(env: NodeJS.ProcessEnv = process.env) {
  return { scope: instagramLoginScopes(env) };
}
