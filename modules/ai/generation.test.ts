import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  db,
  designGenerations,
  designs,
  garmentCategories,
  outbox,
  sql,
  studioSettings,
  STUDIO_SETTINGS_SINGLETON_ID,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { processOneOutboxMessage } from "@/modules/platform/outbox";

import { enqueueDesignGeneration } from "./generation/enqueue";
import {
  handleDesignGenerate,
  registerDesignGenerateHandler,
} from "./generation/handler";
import { buildIdempotencyKey } from "./generation/idempotency";
import * as persistOutput from "./generation/persist-output";
import { ensureStudioSettingsRow } from "./studio/defaults";

let testCategoryId: string;
let testDesignId: string;
let integrationReady = false;

try {
  await db.select({ id: studioSettings.id }).from(studioSettings).limit(1);
  integrationReady = true;
} catch {
  integrationReady = false;
}

(integrationReady ? describe : describe.skip)(
  "design generation integration",
  () => {
  beforeAll(async () => {
    await ensureStudioSettingsRow(null);

    const [category] = await db
      .select({ id: garmentCategories.id })
      .from(garmentCategories)
      .limit(1);
    if (!category) {
      throw new Error("Run db:seed before generation integration tests");
    }
    testCategoryId = category.id;
  });

  beforeEach(async () => {
    process.env.AI_GENERATION_MOCK = "1";
    delete process.env.FAL_KEY;

    testDesignId = uuidv7();

    await db.delete(outbox);
    await db
      .delete(designGenerations)
      .where(eq(designGenerations.designId, testDesignId));
    await db.delete(designs).where(eq(designs.id, testDesignId));

    await db.insert(designs).values({
      id: testDesignId,
      slug: `test-design-gen-${testDesignId}`,
      name: "Test Design",
      garmentTypeId: testCategoryId,
    });

    await db
      .update(studioSettings)
      .set({ monthlySpendCapUsdCents: 50000 })
      .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID));

    registerDesignGenerateHandler();
  });

  afterAll(async () => {
    await db.delete(designs).where(eq(designs.id, testDesignId));
    await sql.end({ timeout: 5 });
  });

  it("refuses enqueue when monthly spend cap is exceeded", async () => {
    await db
      .update(studioSettings)
      .set({ monthlySpendCapUsdCents: 1 })
      .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID));

    await expect(
      enqueueDesignGeneration({
        designId: testDesignId,
        stage: "HERO",
        promptJson: { prompt: "test" },
        templateVersion: 1,
        sourceImageUrl: "https://example.com/sketch.png",
      }),
    ).rejects.toThrow(/spend cap reached/i);
  });

  it("deduplicates enqueue by idempotency key", async () => {
    const input = {
      designId: testDesignId,
      stage: "HERO" as const,
      promptJson: { prompt: "test hero" },
      templateVersion: 1,
      sourceImageUrl: "https://example.com/sketch.png",
      attemptN: 1,
    };

    const first = await enqueueDesignGeneration(input);
    const second = await enqueueDesignGeneration(input);

    expect(second.generationId).toBe(first.generationId);

    const rows = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.designId, testDesignId));
    expect(rows).toHaveLength(1);
  });

  it("records mock generation cost and latency via outbox handler", async () => {
    const { assets } = await import("@aks/db");
    vi.spyOn(persistOutput, "persistGenerationImage").mockImplementation(
      async () => {
        const assetId = uuidv7();
        await db.insert(assets).values({
          id: assetId,
          r2Key: `test-gen/${assetId}`,
          mime: "image/png",
          width: 8,
          height: 8,
          bytes: 64,
          sha256: assetId.replace(/-/g, ""),
          kind: "IMAGE",
        });
        return assetId;
      },
    );

    const { generationId } = await enqueueDesignGeneration({
      designId: testDesignId,
      stage: "HERO",
      promptJson: {
        prompt:
          "Photorealistic fashion e-commerce photograph of a shalwar kameez.",
      },
      templateVersion: 1,
      sourceImageUrl: "https://example.com/sketch.png",
      attemptN: 1,
    });

    const result = await processOneOutboxMessage();
    expect(result.kind).toBe("sent");

    const [row] = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.id, generationId))
      .limit(1);

    expect(row?.status).toBe("SUCCEEDED");
    expect(row?.costUsdMicros).toBeGreaterThan(0);
    expect(row?.latencyMs).toBeGreaterThan(0);
    expect(row?.outputAssetId).toBeTruthy();

    vi.restoreAllMocks();
  });

  it("fails clearly when FAL_KEY is missing and mock is disabled", async () => {
    delete process.env.AI_GENERATION_MOCK;
    const previousFal = process.env.FAL_KEY;
    delete process.env.FAL_KEY;

    const generationId = uuidv7();
    await db.insert(designGenerations).values({
      id: generationId,
      designId: testDesignId,
      stage: "HERO",
      modelId: "fal-ai/flux-general/image-to-image",
      promptJson: {
        prompt: "test",
        sourceImageUrl: "https://example.com/sketch.png",
      },
      templateVersion: 1,
      idempotencyKey: buildIdempotencyKey({
        designId: testDesignId,
        stage: "HERO",
        attemptN: 99,
      }),
    });

    try {
      await expect(handleDesignGenerate({ generationId })).rejects.toThrow(
        /FAL_KEY is not set/i,
      );

      const [row] = await db
        .select()
        .from(designGenerations)
        .where(eq(designGenerations.id, generationId))
        .limit(1);
      expect(row?.processingAttempts).toBe(1);
      expect((row?.latencyMs ?? 0) >= 0).toBe(true);
    } finally {
      if (previousFal !== undefined) process.env.FAL_KEY = previousFal;
    }
  });
  },
);
