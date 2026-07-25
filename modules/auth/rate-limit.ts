import { and, eq, gte, sql } from "drizzle-orm";

import { db, signInAttempts } from "@aks/db";

const WINDOW_MS = 60 * 60 * 1000;
export const OTP_EMAIL_LIMIT = 5;
export const OTP_IP_LIMIT = 20;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "email" | "ip" };

/** Rate-limit OTP issuance: 5/email/hour and 20/IP/hour. */
export async function checkOtpRequestRateLimit(params: {
  email: string;
  ip: string | null;
}): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MS);

  const [emailCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signInAttempts)
    .where(
      and(
        eq(signInAttempts.email, params.email),
        eq(signInAttempts.reason, "otp_request"),
        gte(signInAttempts.createdAt, since),
      ),
    );

  if ((emailCount?.count ?? 0) >= OTP_EMAIL_LIMIT) {
    return { ok: false, reason: "email" };
  }

  if (params.ip) {
    const [ipCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(signInAttempts)
      .where(
        and(
          eq(signInAttempts.ip, params.ip),
          eq(signInAttempts.reason, "otp_request"),
          gte(signInAttempts.createdAt, since),
        ),
      );

    if ((ipCount?.count ?? 0) >= OTP_IP_LIMIT) {
      return { ok: false, reason: "ip" };
    }
  }

  return { ok: true };
}
