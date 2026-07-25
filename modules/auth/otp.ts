import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { db, verificationTokens } from "@aks/db";
import { enqueue } from "@/modules/platform/outbox";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;

export function hashOtp(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function codesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Issue a single-use email OTP and enqueue delivery via the outbox. */
export async function issueEmailOtp(params: {
  email: string;
}): Promise<{ expiresAt: Date }> {
  const email = normalizeEmail(params.email);
  const code = generateOtpCode();
  const tokenHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.transaction(async (tx) => {
    await tx
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, email));

    await tx.insert(verificationTokens).values({
      identifier: email,
      token: tokenHash,
      expires: expiresAt,
    });

    await enqueue(
      "email.send",
      {
        to: email,
        subject: "Your AKS sign-in code",
        text: `Your AKS sign-in code is ${code}. It expires in 10 minutes.`,
        html: `<p>Your AKS sign-in code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
      },
      tx,
    );
  });

  return { expiresAt };
}

/**
 * Verify a submitted OTP against the hashed token.
 * Does not consume the token — call {@link consumeEmailOtp} after full sign-in.
 */
export async function verifyEmailOtp(params: {
  email: string;
  code: string;
}): Promise<boolean> {
  const email = normalizeEmail(params.email);
  const code = params.code.trim();
  if (!/^\d{6}$/.test(code)) return false;

  const tokenHash = hashOtp(code);
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.token, tokenHash),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return false;
  return codesEqual(row.token, tokenHash);
}

/** Delete the OTP token after a successful sign-in (single use). */
export async function consumeEmailOtp(email: string): Promise<void> {
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, normalizeEmail(email)));
}
