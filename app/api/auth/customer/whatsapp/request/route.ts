import { handleWhatsappOtpRequest } from "@/modules/auth/social/whatsapp-login";
import { liveWhatsappLoginDeps } from "@/modules/auth/social/whatsapp-login-deps";

export const runtime = "nodejs";

/**
 * Storefront WhatsApp sign-in code request. Enabled only when
 * AKS_WHATSAPP_LOGIN=1 and the Cloud API is configured. Refuses a phone that
 * belongs to a staff account; new numbers self-provision on verify.
 */
export function POST(request: Request) {
  return handleWhatsappOtpRequest(request, liveWhatsappLoginDeps());
}
