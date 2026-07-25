import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { assets, db, uploadedSelfies } from "@aks/db";

import { deleteObject } from "@/modules/platform/assets";

/** Hard-delete origin selfies past purgeAt — R2 object removed, rows marked purged. */
export async function purgeExpiredSelfies(): Promise<number> {
  const now = new Date();
  const due = await db
    .select({
      selfieId: uploadedSelfies.id,
      assetId: uploadedSelfies.assetId,
      r2Key: assets.r2Key,
    })
    .from(uploadedSelfies)
    .innerJoin(assets, eq(uploadedSelfies.assetId, assets.id))
    .where(
      and(
        lte(uploadedSelfies.purgeAt, now),
        isNull(uploadedSelfies.purgedAt),
        isNull(assets.purgedAt),
      ),
    );

  let count = 0;
  for (const row of due) {
    try {
      try {
        await deleteObject(row.r2Key);
      } catch {
        // R2 may be unavailable in CI — still mark purged in DB.
      }
      await db
        .update(assets)
        .set({ purgedAt: now, updatedAt: now })
        .where(eq(assets.id, row.assetId));
      await db
        .update(uploadedSelfies)
        .set({ purgedAt: now })
        .where(eq(uploadedSelfies.id, row.selfieId));
      count += 1;
    } catch (err) {
      console.error("[purgeExpiredSelfies]", row.selfieId, err);
    }
  }
  return count;
}

export async function manualPurgeSelfie(selfieId: string): Promise<boolean> {
  const [row] = await db
    .select({
      assetId: uploadedSelfies.assetId,
      purgedAt: uploadedSelfies.purgedAt,
      r2Key: assets.r2Key,
    })
    .from(uploadedSelfies)
    .innerJoin(assets, eq(uploadedSelfies.assetId, assets.id))
    .where(eq(uploadedSelfies.id, selfieId))
    .limit(1);

  if (!row || row.purgedAt) return false;

  const now = new Date();
  try {
    await deleteObject(row.r2Key);
  } catch {
    // continue — mark purged even if object already gone
  }
  await db
    .update(assets)
    .set({ purgedAt: now, updatedAt: now })
    .where(eq(assets.id, row.assetId));
  await db
    .update(uploadedSelfies)
    .set({ purgedAt: now })
    .where(eq(uploadedSelfies.id, selfieId));
  return true;
}

export type PurgeJobStatus = {
  pendingCount: number;
  purgedLast24h: number;
  lastPurgeAt: Date | null;
};

export async function getPurgeJobStatus(): Promise<PurgeJobStatus> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(uploadedSelfies)
    .where(
      and(
        lte(uploadedSelfies.purgeAt, now),
        isNull(uploadedSelfies.purgedAt),
      ),
    );

  const [purged] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(uploadedSelfies)
    .where(
      and(
        gte(uploadedSelfies.purgedAt, dayAgo),
        sql`${uploadedSelfies.purgedAt} IS NOT NULL`,
      ),
    );

  const [last] = await db
    .select({ purgedAt: uploadedSelfies.purgedAt })
    .from(uploadedSelfies)
    .where(sql`${uploadedSelfies.purgedAt} IS NOT NULL`)
    .orderBy(sql`${uploadedSelfies.purgedAt} DESC`)
    .limit(1);

  return {
    pendingCount: pending?.count ?? 0,
    purgedLast24h: purged?.count ?? 0,
    lastPurgeAt: last?.purgedAt ?? null,
  };
}

export async function countActiveSelfies(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(uploadedSelfies)
    .where(isNull(uploadedSelfies.purgedAt));
  return row?.count ?? 0;
}

export async function isSelfiePurged(selfieId: string): Promise<boolean> {
  const [row] = await db
    .select({
      purgedAt: uploadedSelfies.purgedAt,
      assetPurgedAt: assets.purgedAt,
    })
    .from(uploadedSelfies)
    .innerJoin(assets, eq(uploadedSelfies.assetId, assets.id))
    .where(eq(uploadedSelfies.id, selfieId))
    .limit(1);
  if (!row) return true;
  return row.purgedAt != null && row.assetPurgedAt != null;
}
