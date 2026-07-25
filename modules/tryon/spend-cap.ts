import { and, eq, gte, sql } from "drizzle-orm";

import { db, designGenerations, tryonSessions } from "@aks/db";

import {
  getMonthlySpendCapUsdMicros,
} from "@/modules/ai/generation/spend-cap";

import { ESTIMATED_TRYON_COST_USD_MICROS } from "./types";

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getTryOnMonthlySpendUsdMicros(): Promise<number> {
  const start = monthStart();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${tryonSessions.costUsdMicros}), 0)::int`,
    })
    .from(tryonSessions)
    .where(
      and(
        gte(tryonSessions.createdAt, start),
        eq(tryonSessions.status, "SUCCEEDED"),
      ),
    );
  return row?.total ?? 0;
}

export async function getCombinedMonthlySpendUsdMicros(): Promise<number> {
  const start = monthStart();
  const [studio] = await db
    .select({
      total: sql<number>`coalesce(sum(${designGenerations.costUsdMicros}), 0)::int`,
    })
    .from(designGenerations)
    .where(
      and(
        gte(designGenerations.createdAt, start),
        eq(designGenerations.status, "SUCCEEDED"),
      ),
    );

  const tryon = await getTryOnMonthlySpendUsdMicros();
  return (studio?.total ?? 0) + tryon;
}

export async function checkTryOnSpendCap(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const cap = await getMonthlySpendCapUsdMicros();
  if (cap == null) return { ok: true };

  const spent = await getCombinedMonthlySpendUsdMicros();
  const estimate = ESTIMATED_TRYON_COST_USD_MICROS * 3;
  if (spent + estimate > cap) {
    return { ok: false, message: "Reflection is resting — back shortly." };
  }
  return { ok: true };
}

export async function getTryOnSpendSummary(): Promise<{
  tryonUsdMicros: number;
  combinedUsdMicros: number;
  capUsdMicros: number | null;
}> {
  const tryonUsdMicros = await getTryOnMonthlySpendUsdMicros();
  const combinedUsdMicros = await getCombinedMonthlySpendUsdMicros();
  const capUsdMicros = await getMonthlySpendCapUsdMicros();
  return { tryonUsdMicros, combinedUsdMicros, capUsdMicros };
}
