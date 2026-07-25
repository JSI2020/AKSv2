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

  // Always record the attempt for rate limiting — even if the user is unknown
  // (avoid email enumeration via timing/status).
  await logSignInAttempt({
    email,
    ip,
    userAgent,
    success: true,
    reason: "otp_request",
  });

  const [user] = await db
    .select({
      id: users.id,
      status: users.status,
      deletedAt: users.deletedAt,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Staff-only portal: only existing non-customer accounts receive codes.
  const isStaff =
    user &&
    !user.deletedAt &&
    user.status !== "DISABLED" &&
    user.role !== "CUSTOMER";

  if (!isStaff) {
    // Same response shape as success — do not reveal whether the email exists.
    return NextResponse.json({
      ok: true,
      message: "If that email is registered, a code has been sent.",
    });
  }

  await issueEmailOtp({ email });

  return NextResponse.json({
    ok: true,
    message: "If that email is registered, a code has been sent.",
  });
}
