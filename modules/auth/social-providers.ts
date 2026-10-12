import {
  readFacebookCredentials,
  readGoogleCredentials,
  readInstagramCredentials,
  readTikTokCredentials,
  whatsappLoginConfigured,
} from "@/modules/auth/social/config";

export type SocialProvider = "google" | "facebook" | "instagram" | "tiktok";

/**
 * Storefront sign-in channels that are actually usable, decided by env.
 * A provider with no credentials is never offered as a live action.
 *
 * Env:
 *   Google    → AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET
 *   Facebook  → AUTH_FACEBOOK_ID + AUTH_FACEBOOK_SECRET
 *   Instagram → AUTH_INSTAGRAM_ID + AUTH_INSTAGRAM_SECRET
 *   TikTok    → AUTH_TIKTOK_CLIENT_KEY + AUTH_TIKTOK_CLIENT_SECRET
 *   WhatsApp  → WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID + AKS_WHATSAPP_LOGIN=1
 */
export function configuredSocialProviders(): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (readGoogleCredentials()) providers.push("google");
  if (readFacebookCredentials()) providers.push("facebook");
  if (readInstagramCredentials()) providers.push("instagram");
  if (readTikTokCredentials()) providers.push("tiktok");
  return providers;
}

export function whatsappLoginEnabled(): boolean {
  return whatsappLoginConfigured();
}

/** Preferred channel order on the Quiet Luxury sign-in panel. */
export type AuthChannelKey =
  "whatsapp" | "facebook" | "instagram" | "tiktok" | "google";

export type AuthChannelState = {
  key: AuthChannelKey;
  /** Live = wired and configured; soon = visible, not offered. */
  status: "live" | "soon";
};

export function storefrontAuthChannels(): AuthChannelState[] {
  const social = new Set(configuredSocialProviders());
  const whatsapp = whatsappLoginEnabled();

  return [
    { key: "whatsapp", status: whatsapp ? "live" : "soon" },
    { key: "facebook", status: social.has("facebook") ? "live" : "soon" },
    { key: "instagram", status: social.has("instagram") ? "live" : "soon" },
    { key: "tiktok", status: social.has("tiktok") ? "live" : "soon" },
    ...(social.has("google")
      ? [{ key: "google" as const, status: "live" as const }]
      : []),
  ];
}
