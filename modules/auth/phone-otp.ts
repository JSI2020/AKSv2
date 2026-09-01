import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db, verificationTokens } from "@aks/db";
import { toWhatsappMsisdn } from "@/modules/customers/phone";
import { sendWhatsappText } from "@/modules/messaging/providers/whatsapp";

import { generateOtpCode, hashOtp, OTP_TTL_MS } from "./otp";

/**
 * Phone-based one-time codes for WhatsApp sign-in, stored in the same
 * verificationTokens table as email codes but under a "wa:" identifier so the
 * two namespaces never collide.
 *
 * Production note: the Cloud API only allows a business-initiated text inside a
 * 24-hour customer-service window. For a cold sign-in code you generally need an
 * approved WhatsApp *authentication* template; sendWhatsappText here covers dev
 * and in-window sends. Swap to sendWhatsappTemplate once a template is approved.
 */

function identifierFor(phone: string): string {
  return `wa:${toWhatsappMsisdn(phone)}`;
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

  // Delivery is outside the DB transaction so a WhatsApp outage cannot roll back
  // a stored code — but in dev we skip the send entirely and surface the code.
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[dev] WhatsApp sign-in code for ${msisdn}: ${code}\n`);
    return { expiresAt, devCode: code };
  }

  await sendWhatsappText({
    to: msisdn,
    body: `Your AKS sign-in code is ${code}. It expires in 24 hours. If you didn't ask for it, ignore this message.`,
  });

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
