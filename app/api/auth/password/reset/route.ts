import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, users } from "@aks/db";
import {
  checkOtpVerifyRateLimit,
  clientIpFromHeaders,
  consumeEmailOtp,
  hashPassword,
  logSignInAttempt,
  normalizeEmail,
  passwordProblem,
  verifyEmailOtp,
} from "@/modules/auth";

export const runtime = "nodejs";

/**
 * Staff "Forgot password": the code from /api/auth/otp/request plus a new
 * password. On success the client signs in with the new password (which still
 * asks Owner/Admin for their authenticator code).
 */
export async function POST(request: Request) {
  let body: { email?: unknown; code?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ip = clientIpFromHeaders(request.headers);
  const userAgent = request.headers.get("user-agent");

  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your email." },
      { status: 400 },
    );
  }

  const problem = passwordProblem(password, email);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const limit = await checkOtpVerifyRateLimit({
    email,
    reasons: ["otp_invalid"],
  });
  if (!limit.ok) {
    await logSignInAttempt({
      email,
      ip,
      userAgent,
      success: false,
      reason: "otp_verify_locked",
    });
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const codeOk = await verifyEmailOtp({ email, code });
  const [user] = codeOk
    ? await db
        .select({
          id: users.id,
          role: users.role,
          status: users.status,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    : [];

  if (
    !codeOk ||
    !user ||
    user.deletedAt ||
    user.status === "DISABLED" ||
    user.role === "CUSTOMER"
  ) {
    await logSignInAttempt({
      email,
      ip,
      userAgent,
      success: false,
      reason: "otp_invalid",
    });
    return NextResponse.json(
      { error: "That code is wrong or has expired." },
      { status: 400 },
    );
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
      passwordSetAt: now,
      emailVerified: now,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));
  await consumeEmailOtp(email);

  await logSignInAttempt({
    email,
    ip,
    userAgent,
    success: true,
    reason: "password_reset",
  });

  return NextResponse.json({ ok: true });
}
