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
import { staffOtpGate } from "@/modules/auth/staff-otp";

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

  // Count every request toward the hourly cap, including addresses that are
  // not staff. The response itself says when no code was sent.
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

  const gate = staffOtpGate(user ?? null);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }

  const issued = await issueEmailOtp({ email });

  return NextResponse.json({
    ok: true,
    message: "A sign-in code is on its way. It expires in 10 minutes.",
    ...(issued.devCode ? { devCode: issued.devCode } : {}),
  });
}
