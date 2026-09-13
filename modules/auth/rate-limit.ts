import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db, signInAttempts } from "@aks/db";

const WINDOW_MS = 60 * 60 * 1000;
/** Failed verify attempts — keep short even when OTP codes last 24h. */
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

export const OTP_EMAIL_LIMIT = 5;
export const OTP_IP_LIMIT = 20;
export const OTP_VERIFY_LIMIT = 8;
export const DEV_OTP_EMAIL_LIMIT = 50;
export const DEV_OTP_IP_LIMIT = 200;
export const DEV_OTP_VERIFY_LIMIT = 30;
export const BANK_RECEIPT_IP_LIMIT = 20;
export const BANK_RECEIPT_ORDER_LIMIT = 5;

/** Local/dev: generous limits so solo testing does not lock you out. Force strict limits with AKS_STRICT_AUTH_RATE_LIMIT=1. */
export function authRateLimitRelaxed(): boolean {
  if (process.env.AKS_STRICT_AUTH_RATE_LIMIT === "1") return false;
  return process.env.NODE_ENV !== "production";
}

function otpRequestLimits(): { email: number; ip: number } {
  if (authRateLimitRelaxed()) {
    return { email: DEV_OTP_EMAIL_LIMIT, ip: DEV_OTP_IP_LIMIT };
  }
  return { email: OTP_EMAIL_LIMIT, ip: OTP_IP_LIMIT };
}

function otpVerifyLimit(): number {
  return authRateLimitRelaxed() ? DEV_OTP_VERIFY_LIMIT : OTP_VERIFY_LIMIT;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "email" | "ip" | "verify" | "order" };

/** Reasons logged when issuing an OTP (staff + storefront). */
export const OTP_REQUEST_REASONS = [
  "otp_request",
  "customer_otp_request",
  "customer_whatsapp_request",
] as const;

/** Rate-limit OTP issuance: 5/email/hour and 20/IP/hour. */
export async function checkOtpRequestRateLimit(params: {
  email: string;
  ip: string | null;
}): Promise<RateLimitResult> {
  const limits = otpRequestLimits();
  const since = new Date(Date.now() - WINDOW_MS);

  const [emailCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signInAttempts)
    .where(
      and(
        eq(signInAttempts.email, params.email),
        inArray(signInAttempts.reason, [...OTP_REQUEST_REASONS]),
        gte(signInAttempts.createdAt, since),
      ),
    );

  if ((emailCount?.count ?? 0) >= limits.email) {
    return { ok: false, reason: "email" };
  }

  if (params.ip) {
    const [ipCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(signInAttempts)
      .where(
        and(
          eq(signInAttempts.ip, params.ip),
          inArray(signInAttempts.reason, [...OTP_REQUEST_REASONS]),
          gte(signInAttempts.createdAt, since),
        ),
      );

    if ((ipCount?.count ?? 0) >= limits.ip) {
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

  if ((row?.count ?? 0) >= otpVerifyLimit()) {
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
