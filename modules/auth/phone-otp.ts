import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db, verificationTokens } from "@aks/db";
import { toWhatsappMsisdn } from "@/modules/customers/phone";
import {
  sendWhatsappAuthOtp,
  sendWhatsappText,
} from "@/modules/messaging/providers/whatsapp";

import { generateOtpCode, hashOtp, OTP_TTL_MS } from "./otp";
import { selectWhatsappOtpDelivery } from "./social/whatsapp-delivery";

/**
 * Phone-based one-time codes for WhatsApp sign-in, stored in the same
 * verificationTokens table as email codes but under a "wa:" identifier so the
 * two namespaces never collide.
 *
 * Delivery:
 * - AKS_ALLOW_DEV_OTP=1 (and not production) → return code in API, no send
 * - WHATSAPP_TEMPLATE_AUTH set → authentication template (cold OTP)
 * - else → free-form text (only works inside Meta's 24h customer window)
 */

function identifierFor(phone: string): string {
  return `wa:${toWhatsappMsisdn(phone)}`;
}

function allowDevOtpSurface(): boolean {
  return selectWhatsappOtpDelivery() === "dev_surface";
}

async function deliverPhoneOtp(msisdn: string, code: string): Promise<void> {
  if (selectWhatsappOtpDelivery() === "auth_template") {
    await sendWhatsappAuthOtp({ to: msisdn, code });
    return;
  }

  await sendWhatsappText({
    to: msisdn,
    body: `Your AKS sign-in code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this message.`,
  });
}

export async function issuePhoneOtp(params: {
  phone: string;
}): Promise<{ expiresAt: Date; devCode?: string }> {
  const msisdn = toWhatsappMsisdn(params.phone);
  const identifier = `wa:${msisdn}`;
  const code = generateOtpCode();
  const tokenHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.transaction(async (tx) => {
    await tx
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier));
    await tx.insert(verificationTokens).values({
      identifier,
      token: tokenHash,
      expires: expiresAt,
    });
  });

  if (allowDevOtpSurface()) {
    console.log(`\n[dev] WhatsApp sign-in code for ${msisdn}: ${code}\n`);
    return { expiresAt, devCode: code };
  }

  // Delivery outside the DB transaction — outage must not roll back a stored code.
  await deliverPhoneOtp(msisdn, code);

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[whatsapp] OTP sent to ${msisdn}\n`);
  }

  return { expiresAt };
}

export async function verifyPhoneOtp(params: {
  phone: string;
  code: string;
}): Promise<boolean> {
  const code = params.code.trim();
  if (!/^\d{6}$/.test(code)) return false;

  const tokenHash = hashOtp(code);
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifierFor(params.phone)),
        eq(verificationTokens.token, tokenHash),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1);

  return Boolean(rows[0]);
}

export async function consumePhoneOtp(phone: string): Promise<void> {
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifierFor(phone)));
}
