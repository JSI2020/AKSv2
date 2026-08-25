"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  assets,
  db,
  insertAuditLog,
  TRYON_SETTINGS_SINGLETON_ID,
  tryonConsents,
  tryonResults,
  tryonSessions,
  tryonSettings,
  uploadedSelfies,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { auth } from "@/auth";
import { clientIpFromHeaders } from "@/modules/auth/sessions";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";
import { completeUpload } from "@/modules/platform/assets";
import { enqueue } from "@/modules/platform/outbox";

import { presignTryOnResult } from "./cache";
import { getTryonSettings } from "./defaults";
import { runTryOnPersonaliseSync } from "./handler";
import { isTryOnAvailable } from "./providers";
import { checkTryOnRateLimit } from "./rate-limit";
import { checkTryOnSpendCap } from "./spend-cap";
import {
  SELFIE_PURGE_HOURS,
  TRYON_CONSENT_COPY,
  TRYON_GALLERY_ANGLES,
  TRYON_UNAVAILABLE_MESSAGE,
  type TryOnGalleryAngle,
} from "./types";
import { validateSelfieAsset } from "./validation";

export type TryOnAvailability = {
  available: boolean;
  message: string | null;
  consentVersion: number;
  consentCopy: typeof TRYON_CONSENT_COPY;
};

export async function getTryOnAvailability(): Promise<TryOnAvailability> {
  const settings = await getTryonSettings();
  if (!settings.enabled || !isTryOnAvailable()) {
    return {
      available: false,
      message: TRYON_UNAVAILABLE_MESSAGE,
      consentVersion: settings.consentVersion,
      consentCopy: TRYON_CONSENT_COPY,
    };
  }

  const spend = await checkTryOnSpendCap();
  if (!spend.ok) {
    return {
      available: false,
      message: spend.message,
      consentVersion: settings.consentVersion,
      consentCopy: TRYON_CONSENT_COPY,
    };
  }

  return {
    available: true,
    message: null,
    consentVersion: settings.consentVersion,
    consentCopy: TRYON_CONSENT_COPY,
  };
}

export type StartTryOnInput = {
  designId: string;
  colourwayId: string;
  archetypeId: string | null;
  assetKey: string;
  mime: string;
  consentGranted: boolean;
  attestationConfirmed: boolean;
  consentVersion: number;
};

export type TryOnAngleResult = {
  angle: TryOnGalleryAngle;
  url: string | null;
  fromCache: boolean;
};

export type StartTryOnResult =
  | {
      ok: true;
      sessionId: string;
      results: TryOnAngleResult[];
    }
  | { ok: false; error: string };

export async function startTryOnSession(
  input: StartTryOnInput,
): Promise<StartTryOnResult> {
  const availability = await getTryOnAvailability();
  if (!availability.available) {
    return { ok: false, error: availability.message ?? TRYON_UNAVAILABLE_MESSAGE };
  }

  if (!input.consentGranted) {
    return { ok: false, error: "Consent is required for Reflection." };
  }
  if (!input.attestationConfirmed) {
    return { ok: false, error: "Please confirm the photo is of you." };
  }

  const settings = await getTryonSettings();
  if (input.consentVersion !== settings.consentVersion) {
    return {
      ok: false,
      error: "Consent version changed — please review and accept again.",
    };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = userId ? null : await getOrSetAnonToken();

  const rate = await checkTryOnRateLimit({ userId, anonId });
  if (!rate.ok) return { ok: false, error: rate.message };

  const hdrs = await headers();
  const ipAddress = clientIpFromHeaders(hdrs);
  const userAgent = hdrs.get("user-agent");

  const purgeAt = new Date(Date.now() + SELFIE_PURGE_HOURS * 60 * 60 * 1000);

  const asset = await completeUpload({
    key: input.assetKey,
    mime: input.mime,
    uploadedById: userId ?? undefined,
    kind: "IMAGE",
    purgeAt,
  });

  const validation = await validateSelfieAsset({
    assetId: asset.id,
    r2Key: input.assetKey,
  });
  if (!validation.ok) {
    const { deleteAsset } = await import("@/modules/platform/assets");
    await deleteAsset(asset.id);
    return { ok: false, error: validation.message };
  }

  const consentId = uuidv7();
  const selfieId = uuidv7();
  const sessionId = uuidv7();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(tryonConsents).values({
      id: consentId,
      userId,
      anonId,
      version: settings.consentVersion,
      grantedAt: now,
      ipAddress,
      userAgent,
    });

    await tx.insert(uploadedSelfies).values({
      id: selfieId,
      consentId,
      assetId: asset.id,
      faceEmbeddingRef: validation.faceEmbeddingRef,
      purgeAt,
    });

    await tx.insert(tryonSessions).values({
      id: sessionId,
      consentId,
      selfieId,
      designId: input.designId,
      colourwayId: input.colourwayId,
      archetypeId: input.archetypeId,
      userId,
      anonId,
      status: "PENDING",
      faceCacheKey: validation.faceEmbeddingRef,
    });

    if (process.env.AI_GENERATION_MOCK === "1") {
      return;
    }
    await enqueue("tryon.personalise", { sessionId }, tx);
  });

  if (process.env.AI_GENERATION_MOCK === "1") {
    await runTryOnPersonaliseSync(sessionId);
  }

  const results = await loadSessionResults(sessionId);
  if (results.length === 0) {
    return { ok: false, error: TRYON_UNAVAILABLE_MESSAGE };
  }

  return { ok: true, sessionId, results };
}

export async function switchTryOnColourway(input: {
  sessionId: string;
  colourwayId: string;
}): Promise<StartTryOnResult> {
  const [existing] = await db
    .select()
    .from(tryonSessions)
    .where(eq(tryonSessions.id, input.sessionId))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Session not found." };
  }

  const availability = await getTryOnAvailability();
  if (!availability.available) {
    return { ok: false, error: availability.message ?? TRYON_UNAVAILABLE_MESSAGE };
  }

  if (existing.colourwayId === input.colourwayId) {
    const results = await loadSessionResults(input.sessionId);
    return { ok: true, sessionId: input.sessionId, results };
  }

  const newSessionId = uuidv7();
  await db.insert(tryonSessions).values({
    id: newSessionId,
    consentId: existing.consentId,
    selfieId: existing.selfieId,
    designId: existing.designId,
    colourwayId: input.colourwayId,
    archetypeId: existing.archetypeId,
    userId: existing.userId,
    anonId: existing.anonId,
    status: "PENDING",
    faceCacheKey: existing.faceCacheKey,
  });

  if (process.env.AI_GENERATION_MOCK === "1") {
    await runTryOnPersonaliseSync(newSessionId);
  } else {
    await db.transaction(async (tx) => {
      await enqueue("tryon.personalise", { sessionId: newSessionId }, tx);
    });
  }

  const results = await loadSessionResults(newSessionId);
  return { ok: true, sessionId: newSessionId, results };
}

async function loadSessionResults(sessionId: string): Promise<TryOnAngleResult[]> {
  const rows = await db
    .select({
      angle: tryonResults.angle,
      r2Key: assets.r2Key,
      fromCache: tryonResults.fromCache,
    })
    .from(tryonResults)
    .innerJoin(assets, eq(tryonResults.assetId, assets.id))
    .where(eq(tryonResults.sessionId, sessionId));

  const byAngle = new Map<string, TryOnAngleResult>();
  for (const row of rows) {
    const angle = row.angle as TryOnGalleryAngle;
    const url = await presignTryOnResult({ angle, assetId: "", r2Key: row.r2Key });
    byAngle.set(angle, { angle, url, fromCache: row.fromCache });
  }

  return TRYON_GALLERY_ANGLES.map(
    (angle) => byAngle.get(angle) ?? { angle, url: null, fromCache: false },
  );
}

export async function getTryOnSessionStatus(sessionId: string): Promise<{
  status: string;
  results: TryOnAngleResult[];
  error: string | null;
}> {
  const [session] = await db
    .select()
    .from(tryonSessions)
    .where(eq(tryonSessions.id, sessionId))
    .limit(1);

  if (!session) {
    return { status: "FAILED", results: [], error: "Session not found." };
  }

  const results = await loadSessionResults(sessionId);
  return { status: session.status, results, error: session.error };
}

export async function markTryOnConversion(sessionId: string): Promise<void> {
  await db
    .update(tryonSessions)
    .set({ addedToCartAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(tryonSessions.id, sessionId), isNull(tryonSessions.addedToCartAt)),
    );
}

export async function revokeTryOnConsent(consentId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await db
    .update(tryonConsents)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(tryonConsents.id, consentId),
        eq(tryonConsents.userId, session.user.id),
        isNull(tryonConsents.revokedAt),
      ),
    );
}

export async function generateTryOnShareCard(input: {
  sessionId: string;
  angle: TryOnGalleryAngle;
  designName: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const { persistShareCard } = await import("./handler");
    const { url } = await persistShareCard(input);
    return { ok: true, url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Share card failed.",
    };
  }
}

export async function adminRefreshDashboard(): Promise<{
  dashboard: Awaited<ReturnType<typeof import("./queries").getTryOnAdminDashboard>>;
  pendingSelfies: Awaited<ReturnType<typeof import("./queries").listPendingSelfies>>;
}> {
  const { getTryOnAdminDashboard, listPendingSelfies } = await import("./queries");
  return {
    dashboard: await getTryOnAdminDashboard(),
    pendingSelfies: await listPendingSelfies(),
  };
}

export async function saveTryOnSettings(formData: FormData): Promise<{
  ok: true;
} | { ok: false; error: string }> {
  const { requirePermission } = await import("@/modules/auth");
  const session = await requirePermission("tryon.edit");

  await getTryonSettings();

  const enabled = formData.get("enabled") === "on";
  const modelId = String(formData.get("modelId") ?? "").trim();
  const anonDailyLimit = Number(formData.get("anonDailyLimit") ?? 3);
  const signedInDailyLimit = Number(formData.get("signedInDailyLimit") ?? 20);

  if (!modelId) return { ok: false, error: "Model id is required." };

  await db
    .update(tryonSettings)
    .set({
      enabled,
      modelId,
      anonDailyLimit,
      signedInDailyLimit,
      updatedAt: new Date(),
    })
    .where(eq(tryonSettings.id, TRYON_SETTINGS_SINGLETON_ID));

  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: session.user.id,
    actorRole: session.user.role ?? null,
    action: "tryon.settings.update",
    entityType: "tryon_settings",
    entityId: TRYON_SETTINGS_SINGLETON_ID,
    before: null,
    after: { enabled, modelId, anonDailyLimit, signedInDailyLimit },
  });

  return { ok: true };
}

export async function adminPurgeSelfie(selfieId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { requirePermission } = await import("@/modules/auth");
  const session = await requirePermission("tryon.purge");

  const { manualPurgeSelfie } = await import("./purge");
  const purged = await manualPurgeSelfie(selfieId);
  if (!purged) return { ok: false, error: "Selfie not found or already purged." };

  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: session.user.id,
    actorRole: session.user.role ?? null,
    action: "tryon.selfie.purge",
    entityType: "uploaded_selfie",
    entityId: selfieId,
    before: null,
    after: { purged: true },
  });

  return { ok: true };
}

export async function adminClearTryOnCache(designId: string): Promise<number> {
  const { requirePermission } = await import("@/modules/auth");
  const session = await requirePermission("tryon.edit");

  const { invalidateCacheForDesign } = await import("./cache");
  const count = await invalidateCacheForDesign(designId);

  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: session.user.id,
    actorRole: session.user.role ?? null,
    action: "tryon.cache.clear",
    entityType: "design",
    entityId: designId,
    before: null,
    after: { cleared: count },
  });

  return count;
}
