export type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

export type SocialOAuthProvider = "facebook" | "instagram" | "tiktok";

const DEFAULT_GRAPH_VERSION = "v21.0";
const DEFAULT_TIKTOK_SCOPES = "user.info.basic,user.info.profile";
const DEFAULT_INSTAGRAM_SCOPES = "instagram_business_basic";
const DEFAULT_FACEBOOK_SCOPES = "email,public_profile";

function pair(
  id: string | undefined,
  secret: string | undefined,
): OAuthCredentials | null {
  const clientId = id?.trim();
  const clientSecret = secret?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function scopeList(raw: string | undefined, fallback: string): string {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const tokens = trimmed.split(/[,\s]+/).filter(Boolean);
  if (tokens.some((token) => !/^[a-z0-9._]+$/i.test(token))) return fallback;
  return tokens.join(",");
}

/** Graph version for Facebook Login and Instagram user info. Invalid values fall back. */
export function metaGraphVersion(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.AUTH_META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
  return /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_GRAPH_VERSION;
}

export function readGoogleCredentials(
  env: NodeJS.ProcessEnv = process.env,
): OAuthCredentials | null {
  return pair(env.AUTH_GOOGLE_ID, env.AUTH_GOOGLE_SECRET);
}

export function readFacebookCredentials(
  env: NodeJS.ProcessEnv = process.env,
): OAuthCredentials | null {
  return pair(env.AUTH_FACEBOOK_ID, env.AUTH_FACEBOOK_SECRET);
}

export function readInstagramCredentials(
  env: NodeJS.ProcessEnv = process.env,
): OAuthCredentials | null {
  return pair(env.AUTH_INSTAGRAM_ID, env.AUTH_INSTAGRAM_SECRET);
}

export function readTikTokCredentials(
  env: NodeJS.ProcessEnv = process.env,
): OAuthCredentials | null {
  return pair(env.AUTH_TIKTOK_CLIENT_KEY, env.AUTH_TIKTOK_CLIENT_SECRET);
}

export function facebookLoginScopes(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return scopeList(env.AUTH_FACEBOOK_SCOPES, DEFAULT_FACEBOOK_SCOPES);
}

export function instagramLoginScopes(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return scopeList(env.AUTH_INSTAGRAM_SCOPES, DEFAULT_INSTAGRAM_SCOPES);
}

export function tikTokScopes(env: NodeJS.ProcessEnv = process.env): string {
  return scopeList(env.AUTH_TIKTOK_SCOPES, DEFAULT_TIKTOK_SCOPES);
}

/**
 * WhatsApp customer sign-in is phone verification over the Cloud API, not OAuth.
 * Embedded Signup onboards a business number; it is the wrong product for shoppers.
 */
export function whatsappLoginConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.AKS_WHATSAPP_LOGIN === "1" &&
    Boolean(env.WHATSAPP_ACCESS_TOKEN?.trim()) &&
    Boolean(env.WHATSAPP_PHONE_NUMBER_ID?.trim())
  );
}

/** Auth.js callback path. Register the absolute URL (`AUTH_URL` + this path) at the provider. */
export function socialCallbackPath(
  provider: "google" | SocialOAuthProvider,
): string {
  return `/api/auth/callback/${provider}`;
}
