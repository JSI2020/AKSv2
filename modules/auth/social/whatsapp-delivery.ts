export type WhatsappOtpDelivery =
  "dev_surface" | "auth_template" | "session_text";

/**
 * How a WhatsApp sign-in code is handed to the shopper.
 * - dev_surface: local only, code returned to the API caller (never in production)
 * - auth_template: approved authentication template (works outside the 24h window)
 * - session_text: free-form text, only delivered inside Meta's customer-care window
 */
export function selectWhatsappOtpDelivery(
  env: NodeJS.ProcessEnv = process.env,
): WhatsappOtpDelivery {
  if (env.NODE_ENV !== "production" && env.AKS_ALLOW_DEV_OTP !== "0") {
    return "dev_surface";
  }
  if (env.WHATSAPP_TEMPLATE_AUTH?.trim()) return "auth_template";
  return "session_text";
}
