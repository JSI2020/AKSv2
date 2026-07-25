import { and, eq, gt } from "drizzle-orm";

import { db, sessions } from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { randomBytes } from "node:crypto";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function parseDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.slice(0, 256);
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Browser";
}

export async function createAuthSession(params: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ id: string; sessionToken: string; expires: Date }> {
  const id = uuidv7();
  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);
  const now = new Date();

  await db.insert(sessions).values({
    id,
    sessionToken,
    userId: params.userId,
    expires,
    device: parseDevice(params.userAgent),
    ip: params.ip ?? null,
    userAgent: params.userAgent?.slice(0, 512) ?? null,
    lastSeenAt: now,
  });

  return { id, sessionToken, expires };
}

export async function getActiveSession(sessionId: string) {
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(eq(sessions.id, sessionId), gt(sessions.expires, new Date())),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function touchSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function listUserSessions(userId: string) {
  return db
    .select({
      id: sessions.id,
      device: sessions.device,
      ip: sessions.ip,
      lastSeenAt: sessions.lastSeenAt,
      createdAt: sessions.createdAt,
      expires: sessions.expires,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expires, new Date())));
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}
