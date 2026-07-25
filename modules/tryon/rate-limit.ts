import { and, eq, gte, sql } from "drizzle-orm";

import { db, tryonSessions } from "@aks/db";

import { getTryonSettings } from "./defaults";

function dayStartUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function countTryOnGenerationsToday(input: {
  userId: string | null;
  anonId: string | null;
}): Promise<number> {
  const start = dayStartUtc();
  const identityFilter =
    input.userId != null
      ? eq(tryonSessions.userId, input.userId)
      : input.anonId != null
        ? eq(tryonSessions.anonId, input.anonId)
        : sql`false`;

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tryonSessions)
    .where(
      and(
        gte(tryonSessions.createdAt, start),
        identityFilter,
        sql`${tryonSessions.costUsdMicros} > 0`,
      ),
    );

  return row?.count ?? 0;
}

export async function checkTryOnRateLimit(input: {
  userId: string | null;
  anonId: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const settings = await getTryonSettings();
  const limit = input.userId != null
    ? settings.signedInDailyLimit
    : settings.anonDailyLimit;

  const used = await countTryOnGenerationsToday(input);
  if (used >= limit) {
    return {
      ok: false,
      message: `Reflection daily limit reached (${limit}/day). Try again tomorrow.`,
    };
  }
  return { ok: true };
}
