import "server-only";

import { eq } from "drizzle-orm";

import { db, WHATSAPP_CONNECTION_ID, whatsappConnections } from "@aks/db";
import { decryptSecret } from "@/modules/auth/encryption";

import { chooseWhatsappSendTarget } from "./whatsapp-coexistence-parse";

export type WhatsappCloudTarget = {
  token: string | null;
  phoneNumberId: string | null;
  phoneSource: "connected" | "env";
};

/**
 * Sending target. A connected coexistence number replaces the env phone
 * number id. The permanent system-user token in env is used when no
 * Embedded Signup token is stored.
 */
export async function resolveWhatsappCloudTarget(): Promise<WhatsappCloudTarget> {
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
  const envPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
  let connectedPhoneNumberId: string | null = null;
  let connectedToken: string | null = null;
  try {
    const [row] = await db
      .select({
        status: whatsappConnections.status,
        phoneNumberId: whatsappConnections.phoneNumberId,
        businessTokenEncrypted: whatsappConnections.businessTokenEncrypted,
      })
      .from(whatsappConnections)
      .where(eq(whatsappConnections.id, WHATSAPP_CONNECTION_ID))
      .limit(1);
    if (row?.status === "CONNECTED" && row.phoneNumberId) {
      connectedPhoneNumberId = row.phoneNumberId;
      if (row.businessTokenEncrypted) {
        try {
          connectedToken = decryptSecret(row.businessTokenEncrypted);
        } catch {
          connectedToken = null;
        }
      }
    }
  } catch {
    // Table missing or database unavailable: keep the env number.
  }
  return chooseWhatsappSendTarget({
    envToken,
    envPhoneNumberId,
    connectedPhoneNumberId,
    connectedToken,
  });
}
