import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, users } from "@aks/db";
import {
  checkOtpRequestRateLimit,
  clientIpFromHeaders,
  issueEmailOtp,
  logSignInAttempt,
  normalizeEmail,
} from "@/modules/auth";

export const runtime = "nodejs";

/**
 * Storefront customer sign-in code request.
 *
 * Unlike the staff route, this issues a code to any valid email — a new
 * shopper self-provisions on first verify. The one exception is a staff email:
 * staff carry 2FA and must sign in through /admin/login, so we do not hand them
 * a customer code here. The response never reveals which case applied.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailRaw =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string"
      ? (body as { email: string }).email
      : "";

  const email = normalizeEmail(emailRaw);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const userAgent = request.headers.get("user-agent");

  const rate = await checkOtpRequestRateLimit({ email, ip });
  if (!rate.ok) {
    await logSignInAttempt({
      email,
      ip,
      userAgent,
      success: false,
      reason: `otp_rate_limited_${rate.reason}`,
    });
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  await logSignInAttempt({
    email,
    ip,
    userAgent,
    success: true,
    reason: "customer_otp_request",
  });

  const [user] = await db
    .select({
      status: users.status,
      deletedAt: users.deletedAt,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const isStaff = user && !user.deletedAt && user.role !== "CUSTOMER";
  const isDisabled = user && (user.deletedAt || user.status === "DISABLED");

  // Staff → send them to the staff portal; disabled → silently drop. Everyone
  // else (existing customer or brand-new email) gets a code.
  if (isStaff || isDisabled) {
    return NextResponse.json({
      ok: true,
      message: "If we can reach that email, a code is on its way.",
    });
  }

  const issued = await issueEmailOtp({ email });

  return NextResponse.json({
    ok: true,
    message: "If we can reach that email, a code is on its way.",
    ...(issued.devCode ? { devCode: issued.devCode } : {}),
  });
}
