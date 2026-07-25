import { and, eq, gte, sql } from "drizzle-orm";

import { db, designGenerations, studioSettings, STUDIO_SETTINGS_SINGLETON_ID } from "@aks/db";

import { estimateCostUsdMicros, jobTypeForStage } from "../providers/fal-models";

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getMonthlySpendUsdMicros(): Promise<number> {
  const start = monthStart();
  const [row] = await db
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
  return row?.total ?? 0;
}

export async function getMonthlySpendCapUsdMicros(): Promise<number | null> {
  const [settings] = await db
    .select({ capCents: studioSettings.monthlySpendCapUsdCents })
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);
  if (settings?.capCents == null) return null;
  return settings.capCents * 10_000;
}

export async function checkSpendCap(input: {
  stage: "HERO" | "ANGLE" | "COLOURWAY";
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const cap = await getMonthlySpendCapUsdMicros();
  if (cap == null) return { ok: true };

  const spent = await getMonthlySpendUsdMicros();
  const estimate = estimateCostUsdMicros(jobTypeForStage(input.stage));
  if (spent + estimate > cap) {
    const spentUsd = (spent / 1_000_000).toFixed(2);
    const capUsd = (cap / 1_000_000).toFixed(2);
    return {
      ok: false,
      message: `Monthly AI spend cap reached ($${spentUsd} of $${capUsd}). Generation refused.`,
    };
  }
  return { ok: true };
}
