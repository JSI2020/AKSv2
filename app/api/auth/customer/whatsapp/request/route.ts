import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, users } from "@aks/db";
import {
  checkOtpRequestRateLimit,
  clientIpFromHeaders,
  logSignInAttempt,
} from "@/modules/auth";
import { issuePhoneOtp } from "@/modules/auth/phone-otp";
import { whatsappLoginEnabled } from "@/modules/auth/social-providers";
import { toWhatsappMsisdn } from "@/modules/customers/phone";

export const runtime = "nodejs";

/**
 * Storefront WhatsApp sign-in code request. Enabled only when
 * AKS_WHATSAPP_LOGIN=1 and the Cloud API is configured. Refuses a phone that
 * belongs to a staff account; new numbers self-provisions on verify.
 */
export async function POST(request: Request) {
  if (!whatsappLoginEnabled()) {
    return NextResponse.json(
      { error: "WhatsApp sign-in is not available." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phoneRaw =
    typeof body === "object" &&
    body !== null &&
    "phone" in body &&
    typeof (body as { phone: unknown }).phone === "string"
      ? (body as { phone: string }).phone
      : "";

  const msisdn = toWhatsappMsisdn(phoneRaw);
  if (msisdn.length < 11) {
    return NextResponse.json(
      { error: "Enter a valid WhatsApp number." },
      { status: 400 },
    );
  }

  const ip = clientIpFromHeaders(request.headers);
  const userAgent = request.headers.get("user-agent");
  const label = `wa:${msisdn}`;

  const rate = await checkOtpRequestRateLimit({ email: label, ip });
  if (!rate.ok) {
    await logSignInAttempt({
      email: label,
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
    email: label,
    ip,
    userAgent,
    success: true,
    reason: "customer_whatsapp_request",
  });

  const [user] = await db
    .select({ role: users.role, deletedAt: users.deletedAt, status: users.status })
    .from(users)
    .where(eq(users.phone, msisdn))
    .limit(1);

  const isStaff = user && !user.deletedAt && user.role !== "CUSTOMER";
  const isDisabled = user && (user.deletedAt || user.status === "DISABLED");

  if (isStaff || isDisabled) {
    return NextResponse.json({
      ok: true,
      message: "If we can reach that number, a code is on its way.",
    });
  }

  try {
    const issued = await issuePhoneOtp({ phone: msisdn });
    return NextResponse.json({
      ok: true,
      message: "If we can reach that number, a code is on its way.",
      ...(issued.devCode ? { devCode: issued.devCode } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not send a WhatsApp code right now." },
      { status: 502 },
    );
  }
}
