import type { AuthChannelState } from "@/modules/auth/social-providers";

export type AuthChannelAction =
  | { type: "ignore" }
  | { type: "route"; href: "/account/login/whatsapp" }
  | { type: "oauth"; provider: "facebook" | "instagram" | "tiktok" | "google" };

/** What a storefront channel button does. "Soon" channels never start a handshake. */
export function authChannelAction(
  channel: AuthChannelState,
): AuthChannelAction {
  if (channel.status !== "live") return { type: "ignore" };
  switch (channel.key) {
    case "whatsapp":
      return { type: "route", href: "/account/login/whatsapp" };
    case "facebook":
    case "instagram":
    case "tiktok":
    case "google":
      return { type: "oauth", provider: channel.key };
  }
}
