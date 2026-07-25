import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

import {
  db,
  tryonConsents,
  tryonResults,
  tryonSessions,
  uploadedSelfies,
  users,
} from "@aks/db";

import { requirePermission } from "@/modules/auth";

import { getTryonSettings } from "./defaults";
import { getPurgeJobStatus } from "./purge";
import { getTryOnSpendSummary } from "./spend-cap";

export type TryOnSessionLogRow = {
  id: string;
  designId: string;
  colourwayId: string;
  status: string;
  costUsdMicros: number | null;
  converted: boolean;
  createdAt: Date;
  userEmail: string | null;
  anonId: string | null;
  resultCount: number;
};

export type TryOnConsentRow = {
  id: string;
  version: number;
  grantedAt: Date;
  revokedAt: Date | null;
  userEmail: string | null;
  anonId: string | null;
  ipAddress: string | null;
};

export type TryOnAdminDashboardData = {
  settings: Awaited<ReturnType<typeof getTryonSettings>>;
  sessions: TryOnSessionLogRow[];
  consents: TryOnConsentRow[];
  purgeStatus: Awaited<ReturnType<typeof getPurgeJobStatus>>;
  spend: Awaited<ReturnType<typeof getTryOnSpendSummary>>;
  conversionRate: number;
};

export async function getTryOnAdminDashboard(): Promise<TryOnAdminDashboardData> {
  await requirePermission("tryon.view");

  const settings = await getTryonSettings();
  const purgeStatus = await getPurgeJobStatus();
  const spend = await getTryOnSpendSummary();

  const sessionsRaw = await db
    .select({
      id: tryonSessions.id,
      designId: tryonSessions.designId,
      colourwayId: tryonSessions.colourwayId,
      status: tryonSessions.status,
      costUsdMicros: tryonSessions.costUsdMicros,
      addedToCartAt: tryonSessions.addedToCartAt,
      createdAt: tryonSessions.createdAt,
      userEmail: users.email,
      anonId: tryonSessions.anonId,
    })
    .from(tryonSessions)
    .leftJoin(users, eq(tryonSessions.userId, users.id))
    .orderBy(desc(tryonSessions.createdAt))
    .limit(50);

  const sessions: TryOnSessionLogRow[] = [];
  for (const row of sessionsRaw) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tryonResults)
      .where(eq(tryonResults.sessionId, row.id));

    sessions.push({
      id: row.id,
      designId: row.designId,
      colourwayId: row.colourwayId,
      status: row.status,
      costUsdMicros: row.costUsdMicros,
      converted: row.addedToCartAt != null,
      createdAt: row.createdAt,
      userEmail: row.userEmail,
      anonId: row.anonId,
      resultCount: countRow?.count ?? 0,
    });
  }

  const consentsRaw = await db
    .select({
      id: tryonConsents.id,
      version: tryonConsents.version,
      grantedAt: tryonConsents.grantedAt,
      revokedAt: tryonConsents.revokedAt,
      userEmail: users.email,
      anonId: tryonConsents.anonId,
      ipAddress: tryonConsents.ipAddress,
    })
    .from(tryonConsents)
    .leftJoin(users, eq(tryonConsents.userId, users.id))
    .orderBy(desc(tryonConsents.grantedAt))
    .limit(50);

  const consents: TryOnConsentRow[] = consentsRaw.map((row) => ({
    id: row.id,
    version: row.version,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    userEmail: row.userEmail,
    anonId: row.anonId,
    ipAddress: row.ipAddress,
  }));

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      converted: sql<number>`count(*) filter (where ${tryonSessions.addedToCartAt} is not null)::int`,
    })
    .from(tryonSessions)
    .where(eq(tryonSessions.status, "SUCCEEDED"));

  const conversionRate =
    totals && totals.total > 0 ? totals.converted / totals.total : 0;

  return {
    settings,
    sessions,
    consents,
    purgeStatus,
    spend,
    conversionRate,
  };
}

export async function listPendingSelfies(): Promise<
  { id: string; purgeAt: Date; purgedAt: Date | null; assetId: string }[]
> {
  await requirePermission("tryon.view");

  return db
    .select({
      id: uploadedSelfies.id,
      purgeAt: uploadedSelfies.purgeAt,
      purgedAt: uploadedSelfies.purgedAt,
      assetId: uploadedSelfies.assetId,
    })
    .from(uploadedSelfies)
    .where(isNull(uploadedSelfies.purgedAt))
    .orderBy(desc(uploadedSelfies.purgeAt))
    .limit(100);
}

export async function countCacheEntriesByDesign(): Promise<
  { designId: string; entries: number }[]
> {
  await requirePermission("tryon.view");

  const rows = await db
    .select({
      designId: tryonSessions.designId,
      entries: sql<number>`count(${tryonResults.id})::int`,
    })
    .from(tryonResults)
    .innerJoin(tryonSessions, eq(tryonResults.sessionId, tryonSessions.id))
    .groupBy(tryonSessions.designId);

  return rows.map((r) => ({ designId: r.designId, entries: r.entries }));
}
