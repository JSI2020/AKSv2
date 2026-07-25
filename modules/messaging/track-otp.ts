import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { and, eq, gt } from "drizzle-orm";

import { db, orders, users, verificationTokens, messageLog } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { normalizeEmail } from "@/modules/auth/otp";
import { enqueue } from "@/modules/platform/outbox/enqueue";

export const TRACK_OTP_TTL_MS = 10 * 60 * 1000;
export const TRACK_ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
export const TRACK_ACCESS_COOKIE = "aks_track_access";

function hashToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function trackIdentifier(orderNumber: string, email: string): string {
  return `track:${orderNumber}:${normalizeEmail(email)}`;
}

function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function codesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function resolveOrderEmail(
  orderNumber: string,
  email: string,
): Promise<{ ok: true; orderId: string } | { ok: false }> {
  const normalized = normalizeEmail(email);
  const [order] = await db
    .select({
      id: orders.id,
      guestEmail: orders.guestEmail,
      userId: orders.userId,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (!order) return { ok: false };

  let userEmail: string | null = null;
  if (order.userId) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);
    userEmail = user?.email ?? null;
  }

  const matches =
    (order.guestEmail && normalizeEmail(order.guestEmail) === normalized) ||
    (userEmail && normalizeEmail(userEmail) === normalized);

  if (!matches) return { ok: false };
  return { ok: true, orderId: order.id };
}

export async function issueTrackOtp(input: {
  orderNumber: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resolved = await resolveOrderEmail(input.orderNumber, input.email);
  if (!resolved.ok) {
    return {
      ok: false,
      error: "We couldn't find that order with this email.",
    };
  }

  const email = normalizeEmail(input.email);
  const identifier = trackIdentifier(input.orderNumber, email);
  const code = generateOtpCode();
  const tokenHash = hashToken(code);
  const expiresAt = new Date(Date.now() + TRACK_OTP_TTL_MS);

  await db.transaction(async (tx) => {
    const messageLogId = uuidv7();

    await tx
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, identifier));

    await tx.insert(verificationTokens).values({
      identifier,
      token: tokenHash,
      expires: expiresAt,
    });

    await tx.insert(messageLog).values({
      id: messageLogId,
      recipient: email,
      templateKey: "track.otp",
      status: "PENDING",
    });

    await enqueue(
      "message.send",
      {
        messageLogId,
        recipient: email,
        templateKey: "track.otp",
        locale: "en",
        vars: {
          orderNumber: input.orderNumber,
          code,
        },
      },
      tx,
    );
  });

  return { ok: true };
}

export async function verifyTrackOtp(input: {
  orderNumber: string;
  email: string;
  code: string;
}): Promise<boolean> {
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return false;

  const identifier = trackIdentifier(input.orderNumber, email);
  const tokenHash = hashToken(code);

  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, tokenHash),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1);

  return rows.length > 0 && codesEqual(rows[0]!.token, tokenHash);
}

export async function grantTrackAccess(input: {
  orderNumber: string;
  email: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const payload = `${input.orderNumber}:${email}:${Date.now() + TRACK_ACCESS_TTL_MS}`;
  const signed = hashToken(payload);
  const jar = await cookies();
  jar.set(TRACK_ACCESS_COOKIE, `${signed}:${payload}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TRACK_ACCESS_TTL_MS / 1000,
    path: "/",
  });

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, trackIdentifier(input.orderNumber, email)));
}

export async function hasTrackAccess(orderNumber: string): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(TRACK_ACCESS_COOKIE)?.value;
  if (!raw) return false;

  const [signed, ...rest] = raw.split(":");
  const payload = rest.join(":");
  if (!signed || !payload) return false;
  if (hashToken(payload) !== signed) return false;

  const [storedOrder, , expiresRaw] = payload.split(":");
  if (storedOrder !== orderNumber) return false;
  const expires = Number(expiresRaw);
  return Number.isFinite(expires) && expires > Date.now();
}
