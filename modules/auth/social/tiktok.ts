import { tikTokScopes } from "./config";
import {
  SocialProviderError,
  graphErrorMessage,
  sanitizeProviderMessage,
} from "./errors";
import { providerFetchInit, readJsonBody, throwIfProviderFailed } from "./http";
import { socialPlaceholderEmail } from "./identity";

export const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/";

export const TIKTOK_PROFILE_FIELDS = [
  "open_id",
  "union_id",
  "avatar_url",
  "display_name",
  "username",
] as const;

export type TikTokProfile = {
  id: string;
  unionId: string | null;
  name: string | null;
  username: string | null;
  image: string | null;
  email: string | null;
};

export function tikTokUserFields(scopes: string): string {
  const fields: string[] = [...TIKTOK_PROFILE_FIELDS];
  if (scopes.split(",").includes("user.info.email")) fields.push("email");
  return fields.join(",");
}

export function tikTokEndpoints(scopes = tikTokScopes()) {
  const userinfo = new URL(TIKTOK_USERINFO_URL);
  userinfo.searchParams.set("fields", tikTokUserFields(scopes));
  return {
    authorize: TIKTOK_AUTHORIZE_URL,
    token: TIKTOK_TOKEN_URL,
    userinfo: userinfo.toString(),
  };
}

/**
 * TikTok Login Kit for Web requires `client_key`, not OAuth's `client_id`.
 * `code_verifier` is for the mobile and desktop PKCE flow. The web token
 * exchange rejects it, which Auth.js then surfaces as `error=Configuration`.
 */
export function rewriteTikTokTokenBody(body: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(body);
  const clientId = next.get("client_id");
  if (clientId && !next.get("client_key")) {
    next.set("client_key", clientId);
  }
  next.delete("client_id");
  next.delete("code_verifier");
  return next;
}

function tikTokTokenRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    if (typeof nested.access_token === "string") {
      return { ...record, ...nested };
    }
  }
  return record;
}

/** Non-empty provider error. An empty string or `{ code: "ok" }` is success. */
function tikTokTokenError(record: Record<string, unknown>): string | null {
  const error = record.error;
  if (typeof error === "string") {
    const code = error.trim();
    return code || null;
  }
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      const trimmed = code.trim();
      if (trimmed && trimmed !== "ok") return trimmed;
    }
    if (typeof code === "number" && code !== 0) return String(code);
  }
  return null;
}

export async function conformTikTokTokenResponse(
  response: Response,
): Promise<Response> {
  const body = await readJsonBody(response);
  const message = graphErrorMessage(body);
  const record = tikTokTokenRecord(body);
  const accessToken =
    typeof record.access_token === "string" ? record.access_token.trim() : "";
  const tokenError = tikTokTokenError(record);
  if (!response.ok || !accessToken || tokenError) {
    const description = sanitizeProviderMessage(
      message ??
        (response.ok
          ? "TikTok did not return an access token."
          : `HTTP ${response.status}`),
    );
    console.error(
      "[auth] tiktok token",
      response.status,
      tokenError ?? "invalid_grant",
      description,
    );
    return new Response(
      JSON.stringify({
        error: tokenError ?? "invalid_grant",
        error_description: description,
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  const expires = record.expires_in;
  return new Response(
    JSON.stringify({
      ...record,
      access_token: accessToken,
      token_type: "bearer",
      ...(typeof expires === "number" ? { expires_in: expires } : {}),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

export function parseTikTokProfile(body: unknown): TikTokProfile {
  if (!body || typeof body !== "object") {
    throw new SocialProviderError(
      "tiktok",
      "TikTok returned an unreadable profile.",
      "invalid_profile",
    );
  }
  const data = (body as { data?: { user?: unknown } }).data;
  const user =
    data &&
    typeof data === "object" &&
    data.user &&
    typeof data.user === "object"
      ? (data.user as Record<string, unknown>)
      : null;
  const id = typeof user?.open_id === "string" ? user.open_id.trim() : "";
  if (!id) {
    throw new SocialProviderError(
      "tiktok",
      "TikTok did not return an account id.",
      "invalid_profile",
    );
  }
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  return {
    id,
    unionId:
      typeof user?.union_id === "string" && user.union_id.trim()
        ? user.union_id
        : null,
    name:
      typeof user?.display_name === "string" && user.display_name.trim()
        ? user.display_name.trim()
        : null,
    username:
      typeof user?.username === "string" && user.username.trim()
        ? user.username.trim()
        : null,
    image:
      typeof user?.avatar_url === "string" && user.avatar_url.trim()
        ? user.avatar_url
        : null,
    email: email.includes("@") ? email : null,
  };
}

export function mapTikTokProfile(profile: TikTokProfile): {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
} {
  const email = profile.email ?? socialPlaceholderEmail("tiktok", profile.id);
  if (!email) {
    throw new SocialProviderError(
      "tiktok",
      "TikTok account could not be mapped.",
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

export async function fetchTikTokProfile(input: {
  accessToken: string;
  scopes?: string;
  fetchImpl?: typeof fetch;
}): Promise<TikTokProfile> {
  const token = input.accessToken.trim();
  if (!token) {
    throw new SocialProviderError("tiktok", "Missing TikTok access token.");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    tikTokEndpoints(input.scopes).userinfo,
    providerFetchInit({
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const body = await readJsonBody(response);
  throwIfProviderFailed({ provider: "tiktok", response, body });
  return parseTikTokProfile(body);
}
