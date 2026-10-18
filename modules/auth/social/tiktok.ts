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
 * TikTok Login Kit requires `client_key`. Auth.js sends `client_id`.
 * Rewrite the token body so the official parameter name is what gets posted.
 */
export function rewriteTikTokTokenBody(body: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(body);
  const clientId = next.get("client_id");
  if (clientId && !next.get("client_key")) {
    next.set("client_key", clientId);
  }
  next.delete("client_id");
  return next;
}

export async function conformTikTokTokenResponse(
  response: Response,
): Promise<Response> {
  const body = await readJsonBody(response);
  const message = graphErrorMessage(body);
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const accessToken =
    typeof record.access_token === "string" ? record.access_token.trim() : "";
  if (!response.ok || !accessToken || typeof record.error === "string") {
    return new Response(
      JSON.stringify({
        error:
          typeof record.error === "string" ? record.error : "invalid_grant",
        error_description: sanitizeProviderMessage(
          message ??
            (response.ok
              ? "TikTok did not return an access token."
              : `HTTP ${response.status}`),
        ),
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
