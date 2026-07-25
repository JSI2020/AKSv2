import { and, eq } from "drizzle-orm";

import { assets, db, tryonResults } from "@aks/db";

import { createPresignedReadUrl } from "@/modules/platform/assets";

import type { TryOnGalleryAngle } from "./types";

export type CachedTryOnResult = {
  angle: TryOnGalleryAngle;
  assetId: string;
  r2Key: string;
};

export async function findCachedTryOnResult(input: {
  cacheKey: string;
  angle: TryOnGalleryAngle;
}): Promise<CachedTryOnResult | null> {
  const [row] = await db
    .select({
      assetId: tryonResults.assetId,
      r2Key: assets.r2Key,
    })
    .from(tryonResults)
    .innerJoin(assets, eq(tryonResults.assetId, assets.id))
    .where(
      and(
        eq(tryonResults.cacheKey, input.cacheKey),
        eq(tryonResults.angle, input.angle),
      ),
    )
    .limit(1);

  if (!row) return null;
  return { angle: input.angle, assetId: row.assetId, r2Key: row.r2Key };
}

export async function findAllCachedTryOnResults(
  cacheKey: string,
  angles: readonly TryOnGalleryAngle[],
): Promise<Map<TryOnGalleryAngle, CachedTryOnResult>> {
  const map = new Map<TryOnGalleryAngle, CachedTryOnResult>();
  for (const angle of angles) {
    const hit = await findCachedTryOnResult({ cacheKey, angle });
    if (hit) map.set(angle, hit);
  }
  return map;
}

export async function presignTryOnResult(
  result: CachedTryOnResult,
): Promise<string | null> {
  try {
    return await createPresignedReadUrl(result.r2Key, 3600);
  } catch {
    return null;
  }
}

export async function invalidateCacheForDesign(designId: string): Promise<number> {
  const { tryonSessions } = await import("@aks/db");
  const sessions = await db
    .select({ id: tryonSessions.id })
    .from(tryonSessions)
    .where(eq(tryonSessions.designId, designId));

  if (sessions.length === 0) return 0;

  let deleted = 0;
  for (const session of sessions) {
    const results = await db
      .select({ id: tryonResults.id })
      .from(tryonResults)
      .where(eq(tryonResults.sessionId, session.id));
    deleted += results.length;
    await db.delete(tryonResults).where(eq(tryonResults.sessionId, session.id));
  }
  return deleted;
}

export async function countCacheEntriesForDesign(designId: string): Promise<number> {
  const { tryonSessions } = await import("@aks/db");
  const [row] = await db
    .select({ count: tryonResults.id })
    .from(tryonResults)
    .innerJoin(tryonSessions, eq(tryonResults.sessionId, tryonSessions.id))
    .where(eq(tryonSessions.designId, designId));
  return row ? 1 : 0;
}
