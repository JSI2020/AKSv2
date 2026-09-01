import type { SocialProvider } from "@/modules/account/customer-login-form";

/**
 * Which storefront sign-in methods are actually usable, decided purely by what
 * credentials the environment carries. A provider with no keys is never
 * offered — no dead buttons, and no need to redeploy code to turn one on.
 *
 * Env, per provider:
 *   Google    → AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET
 *   Facebook  → AUTH_FACEBOOK_ID + AUTH_FACEBOOK_SECRET
 *   WhatsApp  → WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (already used
 *               by the messaging provider) + AKS_WHATSAPP_LOGIN=1 to opt in
 */
export function configuredSocialProviders(): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push("google");
  }
  if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
    providers.push("facebook");
  }
  return providers;
}

export function whatsappLoginEnabled(): boolean {
  return (
    process.env.AKS_WHATSAPP_LOGIN === "1" &&
    !!process.env.WHATSAPP_ACCESS_TOKEN &&
    !!process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}
