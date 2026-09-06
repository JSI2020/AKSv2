import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, users } from "@aks/db";
import {
  checkOtpVerifyRateLimit,
  normalizeEmail,
  verifyEmailOtp,
} from "@/modules/auth";

export const runtime = "nodejs";

/**
 * Pre-flight for the email signup flow: confirm the code is valid and report
 * whether this email is a brand-new account, WITHOUT consuming the code — the
 * final signIn call consumes it. The client uses `isNew` to decide whether to
 * ask a first-time shopper for their name before completing signup; a returning
 * customer skips straight to signIn.
 *
 * `isNew` is only ever returned after a valid code, i.e. to someone who has
 * proven they control the inbox — so it is not an account-enumeration leak.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const read = (key: string): string =>
    typeof body === "object" &&
    body !== null &&
    key in body &&
    typeof (body as Record<string, unknown>)[key] === "string"
      ? ((body as Record<string, string>)[key] ?? "")
      : "";

  const email = normalizeEmail(read("email"));
  const otp = read("otp").trim();

  if (!email || !otp) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const limit = await checkOtpVerifyRateLimit({
    email,
    reasons: ["otp_invalid"],
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const valid = await verifyEmailOtp({ email, code: otp });
  if (!valid) {
    return NextResponse.json({ ok: false });
  }

  const [user] = await db
    .select({ id: users.id, role: users.role, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Staff must use the admin portal; surface as an error rather than "new".
  if (user && !user.deletedAt && user.role !== "CUSTOMER") {
    return NextResponse.json({ ok: false, error: "Use the staff portal." });
  }

  const isNew = !user || Boolean(user.deletedAt);
  return NextResponse.json({ ok: true, isNew });
}
