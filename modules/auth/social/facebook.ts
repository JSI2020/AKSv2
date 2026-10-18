import { metaGraphVersion } from "./config";
import { SocialProviderError, sanitizeProviderMessage } from "./errors";
import { providerFetchInit, readJsonBody, throwIfProviderFailed } from "./http";
import { socialPlaceholderEmail } from "./identity";

export const FACEBOOK_PROFILE_FIELDS = "id,name,email,picture";

export type FacebookProfile = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export function facebookEndpoints(version = metaGraphVersion()) {
  return {
    authorize: `https://www.facebook.com/${version}/dialog/oauth`,
    token: `https://graph.facebook.com/${version}/oauth/access_token`,
    userinfo: `https://graph.facebook.com/${version}/me?fields=${FACEBOOK_PROFILE_FIELDS}`,
  };
}

export function parseFacebookProfile(body: unknown): FacebookProfile {
  if (!body || typeof body !== "object") {
    throw new SocialProviderError(
      "facebook",
      "Facebook returned an unreadable profile.",
      "invalid_profile",
    );
  }
  const record = body as {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    picture?: { data?: { url?: unknown } | null } | null;
  };
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) {
    throw new SocialProviderError(
      "facebook",
      "Facebook did not return an account id.",
      "invalid_profile",
    );
  }
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const picture = record.picture?.data?.url;
  return {
    id,
    name:
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : null,
    email: email.includes("@") ? email : null,
    image: typeof picture === "string" && picture.trim() ? picture : null,
  };
}

export function mapFacebookProfile(profile: FacebookProfile): {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
} {
  const email = profile.email ?? socialPlaceholderEmail("facebook", profile.id);
  if (!email) {
    throw new SocialProviderError(
      "facebook",
      "Facebook account could not be mapped.",
      "invalid_profile",
    );
  }
  return {
    id: profile.id,
    name: profile.name,
    email,
    image: profile.image,
  };
}

export async function fetchFacebookProfile(input: {
  accessToken: string;
  version?: string;
  fetchImpl?: typeof fetch;
}): Promise<FacebookProfile> {
  const token = input.accessToken.trim();
  if (!token) {
    throw new SocialProviderError("facebook", "Missing Facebook access token.");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    facebookEndpoints(input.version).userinfo,
    providerFetchInit({
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const body = await readJsonBody(response);
  try {
    throwIfProviderFailed({ provider: "facebook", response, body });
  } catch (error) {
    if (error instanceof SocialProviderError) throw error;
    throw new SocialProviderError(
      "facebook",
      sanitizeProviderMessage(
        error instanceof Error ? error.message : "Facebook profile failed.",
      ),
    );
  }
  return parseFacebookProfile(body);
}
