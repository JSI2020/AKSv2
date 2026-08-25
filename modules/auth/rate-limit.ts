import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db, signInAttempts } from "@aks/db";

const WINDOW_MS = 60 * 60 * 1000;
/** Match OTP TTL — lock failed verifies within the code lifetime. */
const VERIFY_WINDOW_MS = 10 * 60 * 1000;

export const OTP_EMAIL_LIMIT = 5;
export const OTP_IP_LIMIT = 20;
export const OTP_VERIFY_LIMIT = 8;
export const BANK_RECEIPT_IP_LIMIT = 20;
export const BANK_RECEIPT_ORDER_LIMIT = 5;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "email" | "ip" | "verify" | "order" };

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

/**
 * Cap failed OTP / 2FA verification attempts per email (or track key) within
 * the OTP TTL window. Uses existing signInAttempts rows.
 */
export async function checkOtpVerifyRateLimit(params: {
  email: string;
  reasons?: string[];
}): Promise<RateLimitResult> {
  const since = new Date(Date.now() - VERIFY_WINDOW_MS);
  const reasons = params.reasons ?? ["otp_invalid", "2fa_invalid"];

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signInAttempts)
    .where(
      and(
        eq(signInAttempts.email, params.email.trim().toLowerCase()),
        inArray(signInAttempts.reason, reasons),
        eq(signInAttempts.success, false),
        gte(signInAttempts.createdAt, since),
      ),
    );

  if ((row?.count ?? 0) >= OTP_VERIFY_LIMIT) {
    return { ok: false, reason: "verify" };
  }
  return { ok: true };
}

/** Throttle guest bank-transfer receipt submissions. */
export async function checkBankReceiptRateLimit(params: {
  ip: string | null;
  orderNumber: string;
}): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MS);
  const orderKey = `order:${params.orderNumber.trim().toUpperCase()}`;

  const [orderCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signInAttempts)
    .where(
      and(
        eq(signInAttempts.email, orderKey),
        eq(signInAttempts.reason, "bank_receipt_submit"),
        gte(signInAttempts.createdAt, since),
      ),
    );

  if ((orderCount?.count ?? 0) >= BANK_RECEIPT_ORDER_LIMIT) {
    return { ok: false, reason: "order" };
  }

  if (params.ip) {
    const [ipCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(signInAttempts)
      .where(
        and(
          eq(signInAttempts.ip, params.ip),
          eq(signInAttempts.reason, "bank_receipt_submit"),
          gte(signInAttempts.createdAt, since),
        ),
      );

    if ((ipCount?.count ?? 0) >= BANK_RECEIPT_IP_LIMIT) {
      return { ok: false, reason: "ip" };
    }
  }

  return { ok: true };
}
