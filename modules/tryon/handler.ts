import { and, asc, eq, inArray } from "drizzle-orm";

import {
  assets,
  db,
  designRenders,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { registerHandler } from "@/modules/platform/outbox";
import {
  completeUpload,
  createPresignedReadUrl,
  getObjectBytes,
  uploadBufferToR2,
} from "@/modules/platform/assets";

import { burnInAiBadge } from "./badge";
import { findAllCachedTryOnResults } from "./cache";
import { getTryonSettings } from "./defaults";
import { getTryOnProvider } from "./providers";
import {
  buildTryOnCacheKey,
  TRYON_GALLERY_ANGLES,
  type TryOnGalleryAngle,
} from "./types";

export async function loadGarmentRenderUrls(input: {
  designId: string;
  colourwayId: string;
  archetypeId: string | null;
}): Promise<Map<TryOnGalleryAngle, string>> {
  const rows = await db
    .select({
      angle: designRenders.angle,
      r2Key: assets.r2Key,
    })
    .from(designRenders)
    .innerJoin(assets, eq(designRenders.assetId, assets.id))
    .where(
      and(
        eq(designRenders.designId, input.designId),
        eq(designRenders.colourwayId, input.colourwayId),
        inArray(designRenders.angle, [...TRYON_GALLERY_ANGLES]),
        input.archetypeId
          ? eq(designRenders.archetypeId, input.archetypeId)
          : undefined,
      ),
    )
    .orderBy(asc(designRenders.sortOrder));

  const map = new Map<TryOnGalleryAngle, string>();
  for (const row of rows) {
    if (!(TRYON_GALLERY_ANGLES as readonly string[]).includes(row.angle)) continue;
    if (map.has(row.angle as TryOnGalleryAngle)) continue;
    const url = await createPresignedReadUrl(row.r2Key, 3600);
    map.set(row.angle as TryOnGalleryAngle, url);
  }
  return map;
}

export async function personaliseTryOnAngle(input: {
  sessionId: string;
  angle: TryOnGalleryAngle;
  cacheKey: string;
  targetImageUrl: string;
  faceImageUrl: string;
  modelId: string;
}): Promise<{ assetId: string; costUsdMicros: number; fromCache: boolean }> {
  const cached = await findAllCachedTryOnResults(input.cacheKey, [input.angle]);
  const hit = cached.get(input.angle);
  if (hit) {
    return { assetId: hit.assetId, costUsdMicros: 0, fromCache: true };
  }

  const provider = getTryOnProvider();
  const result = await provider.personalise({
    modelId: input.modelId,
    targetImageUrl: input.targetImageUrl,
    faceImageUrl: input.faceImageUrl,
  });

  let body: Buffer;
  if (result.imageUrl.startsWith("data:")) {
    const base64 = result.imageUrl.split(",")[1]?.split("#")[0] ?? "";
    body = Buffer.from(base64, "base64");
  } else {
    const res = await fetch(result.imageUrl);
    if (!res.ok) throw new Error(`Failed to download try-on image: ${res.status}`);
    body = Buffer.from(await res.arrayBuffer());
  }

  const badged = await burnInAiBadge(body);
  const { key } = await uploadBufferToR2({
    body: badged,
    mime: "image/png",
    keyPrefix: `tryon/${input.sessionId}`,
  });
  const asset = await completeUpload({
    key,
    mime: "image/png",
    isAiGenerated: true,
  });

  return {
    assetId: asset.id,
    costUsdMicros: result.costUsdMicros,
    fromCache: false,
  };
}

export async function handleTryOnPersonalise(
  payload: Record<string, unknown>,
): Promise<void> {
  const sessionId = String(payload.sessionId ?? "");
  if (!sessionId) throw new Error("tryon.personalise missing sessionId");

  const { tryonSessions, tryonResults, uploadedSelfies } = await import("@aks/db");

  const [session] = await db
    .select()
    .from(tryonSessions)
    .where(eq(tryonSessions.id, sessionId))
    .limit(1);

  if (!session || session.status === "SUCCEEDED") return;

  await db
    .update(tryonSessions)
    .set({ status: "RUNNING", updatedAt: new Date() })
    .where(eq(tryonSessions.id, sessionId));

  try {
    const settings = await getTryonSettings();
    const [selfie] = await db
      .select({
        assetId: uploadedSelfies.assetId,
        r2Key: assets.r2Key,
      })
      .from(uploadedSelfies)
      .innerJoin(assets, eq(uploadedSelfies.assetId, assets.id))
      .where(eq(uploadedSelfies.id, session.selfieId))
      .limit(1);

    if (!selfie) throw new Error("Selfie not found");

    const faceImageUrl = await createPresignedReadUrl(selfie.r2Key, 3600);
    const garmentUrls = await loadGarmentRenderUrls({
      designId: session.designId,
      colourwayId: session.colourwayId,
      archetypeId: session.archetypeId,
    });

    const cacheKey = buildTryOnCacheKey({
      faceEmbeddingRef: session.faceCacheKey.split(":")[0] ?? session.faceCacheKey,
      designId: session.designId,
      colourwayId: session.colourwayId,
      archetypeId: session.archetypeId,
    });

    let totalCost = 0;
    for (const angle of TRYON_GALLERY_ANGLES) {
      const targetUrl = garmentUrls.get(angle);
      if (!targetUrl) continue;

      const { assetId, costUsdMicros, fromCache } = await personaliseTryOnAngle({
        sessionId,
        angle,
        cacheKey,
        targetImageUrl: targetUrl,
        faceImageUrl,
        modelId: settings.modelId,
      });

      totalCost += costUsdMicros;

      await db.insert(tryonResults).values({
        id: uuidv7(),
        sessionId,
        angle,
        assetId,
        cacheKey,
        costUsdMicros,
        fromCache,
      });
    }

    await db
      .update(tryonSessions)
      .set({
        status: "SUCCEEDED",
        costUsdMicros: totalCost,
        updatedAt: new Date(),
      })
      .where(eq(tryonSessions.id, sessionId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(tryonSessions)
      .set({
        status: "FAILED",
        error: message,
        updatedAt: new Date(),
      })
      .where(eq(tryonSessions.id, sessionId));
    throw err;
  }
}

export async function runTryOnPersonaliseSync(sessionId: string): Promise<void> {
  await handleTryOnPersonalise({ sessionId });
}

export function registerTryOnHandlers(): void {
  registerHandler("tryon.personalise", handleTryOnPersonalise);
  registerHandler("tryon.purgeSelfies", async () => {
    const { purgeExpiredSelfies } = await import("./purge");
    const n = await purgeExpiredSelfies();
    console.log(`[worker] purged ${n} selfies`);
  });
}

/** Persist share card to R2 for download. */
export async function persistShareCard(input: {
  sessionId: string;
  angle: TryOnGalleryAngle;
  designName: string;
}): Promise<{ assetId: string; url: string }> {
  const { tryonResults } = await import("@aks/db");
  const [row] = await db
    .select({ r2Key: assets.r2Key })
    .from(tryonResults)
    .innerJoin(assets, eq(tryonResults.assetId, assets.id))
    .where(
      and(
        eq(tryonResults.sessionId, input.sessionId),
        eq(tryonResults.angle, input.angle),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Try-on result not found");

  const body = await getObjectBytes(row.r2Key);
  const { buildShareCard } = await import("./share-card");
  const card = await buildShareCard({ resultImage: body, designName: input.designName });

  const { key } = await uploadBufferToR2({
    body: card,
    mime: "image/jpeg",
    keyPrefix: `tryon/share/${input.sessionId}`,
  });
  const asset = await completeUpload({ key, mime: "image/jpeg", isAiGenerated: true });
  const url = await createPresignedReadUrl(key, 3600);
  return { assetId: asset.id, url };
}
