import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assets,
  db,
  sql,
  tryonConsents,
  tryonResults,
  tryonSessions,
  uploadedSelfies,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { MOCK_PNG_BASE64 } from "@/modules/ai/providers/mock";

import { buildTryOnCacheKey } from "./types";
import { computeFaceEmbeddingRef } from "./validation";
import {
  isSelfiePurged,
  purgeExpiredSelfies,
} from "./purge";
import { ensureTryonSchema } from "./test-setup";

describe("Reflection try-on", () => {
  beforeAll(async () => {
    process.env.AI_GENERATION_MOCK = "1";
    await ensureTryonSchema();
    const { ensureTryonSettingsRow } = await import("./defaults");
    await ensureTryonSettingsRow();
  });

  afterAll(async () => {
    await db.delete(tryonResults);
    await db.delete(tryonSessions);
    await db.delete(uploadedSelfies);
    await db.delete(tryonConsents);
    await sql.end({ timeout: 5 });
  });

  it("builds cache keys that differ by colourway but not on colour toggle reuse", () => {
    const face = "abc123";
    const designId = uuidv7();
    const colourA = uuidv7();
    const colourB = uuidv7();
    const archetypeId = uuidv7();

    const keyA = buildTryOnCacheKey({
      faceEmbeddingRef: face,
      designId,
      colourwayId: colourA,
      archetypeId,
    });
    const keyB = buildTryOnCacheKey({
      faceEmbeddingRef: face,
      designId,
      colourwayId: colourB,
      archetypeId,
    });
    const keyA2 = buildTryOnCacheKey({
      faceEmbeddingRef: face,
      designId,
      colourwayId: colourA,
      archetypeId,
    });

    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe(keyA2);
  });

  it("hard-deletes expired selfies via purge worker", async () => {
    const body = Buffer.from(MOCK_PNG_BASE64, "base64");
    const assetId = uuidv7();
    const consentId = uuidv7();
    const selfieId = uuidv7();
    const r2Key = `test/selfie-${selfieId}.png`;
    const purgeAt = new Date(Date.now() - 60_000);

    await db.insert(assets).values({
      id: assetId,
      r2Key,
      mime: "image/png",
      width: 800,
      height: 800,
      bytes: body.byteLength,
      sha256: computeFaceEmbeddingRef(body),
      kind: "IMAGE",
      purgeAt,
    });

    await db.insert(tryonConsents).values({
      id: consentId,
      anonId: "test-anon",
      version: 1,
      grantedAt: new Date(),
    });

    await db.insert(uploadedSelfies).values({
      id: selfieId,
      consentId,
      assetId,
      faceEmbeddingRef: computeFaceEmbeddingRef(body),
      purgeAt,
    });

    const purged = await purgeExpiredSelfies();
    expect(purged).toBeGreaterThanOrEqual(1);

    const gone = await isSelfiePurged(selfieId);
    expect(gone).toBe(true);

    const [assetRow] = await db
      .select({ purgedAt: assets.purgedAt })
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);
    expect(assetRow?.purgedAt).not.toBeNull();

    const [selfieRow] = await db
      .select({ purgedAt: uploadedSelfies.purgedAt })
      .from(uploadedSelfies)
      .where(eq(uploadedSelfies.id, selfieId))
      .limit(1);
    expect(selfieRow?.purgedAt).not.toBeNull();
  });
});
