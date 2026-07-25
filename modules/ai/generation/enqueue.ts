import { eq } from "drizzle-orm";

import {
  db,
  designGenerations,
  studioSettings,
  STUDIO_SETTINGS_SINGLETON_ID,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { enqueue } from "@/modules/platform/outbox";
import type { DbTx } from "@/modules/platform/types";

import { assertHeroLockedForDownstream } from "@/modules/designs/studio-pipeline";

import { jobTypeForStage } from "../providers/fal-models";
import { buildIdempotencyKey } from "./idempotency";
import { checkSpendCap } from "./spend-cap";

export type EnqueueDesignGenerationInput = {
  designId: string;
  stage: "HERO" | "ANGLE" | "COLOURWAY";
  angle?: string | null;
  colourwayId?: string | null;
  parentGenerationId?: string | null;
  archetypeId?: string | null;
  sizeBlockSnapshot?: Record<string, unknown> | null;
  modelId?: string;
  promptJson: Record<string, unknown>;
  negativePrompt?: string | null;
  seed?: number | null;
  templateVersion: number;
  inputAssetIds?: string[];
  sourceImageUrl: string;
  attemptN?: number;
};

async function resolveModelId(
  stage: "HERO" | "ANGLE" | "COLOURWAY",
  override?: string,
): Promise<string> {
  if (override) return override;
  const jobType = jobTypeForStage(stage);
  const [settings] = await db
    .select({ models: studioSettings.defaultAiModels })
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);
  const models = settings?.models;
  if (!models?.[jobType]) {
    throw new Error(`No fal model configured for job type "${jobType}"`);
  }
  return models[jobType];
}

async function nextAttemptN(input: {
  designId: string;
  stage: "HERO" | "ANGLE" | "COLOURWAY";
  angle?: string | null;
  colourwayId?: string | null;
}): Promise<number> {
  const angle = input.angle?.trim() || "_";
  const colourway = input.colourwayId ?? "_";
  const prefix = `${input.designId}:${input.stage}:${angle}:${colourway}:`;
  const rows = await db
    .select({ key: designGenerations.idempotencyKey })
    .from(designGenerations)
    .where(eq(designGenerations.designId, input.designId));
  const matching = rows.filter((r) => r.key.startsWith(prefix));
  return matching.length + 1;
}

export async function enqueueDesignGeneration(
  input: EnqueueDesignGenerationInput,
  tx?: DbTx,
): Promise<{ generationId: string; idempotencyKey: string }> {
  const cap = await checkSpendCap({ stage: input.stage });
  if (!cap.ok) {
    throw new Error(cap.message);
  }

  await assertHeroLockedForDownstream(input.designId, input.stage);

  const attemptN =
    input.attemptN ??
    (await nextAttemptN({
      designId: input.designId,
      stage: input.stage,
      angle: input.angle,
      colourwayId: input.colourwayId,
    }));

  const idempotencyKey = buildIdempotencyKey({
    designId: input.designId,
    stage: input.stage,
    angle: input.angle,
    colourwayId: input.colourwayId,
    attemptN,
  });

  const existing = await db
    .select({ id: designGenerations.id })
    .from(designGenerations)
    .where(eq(designGenerations.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing[0]) {
    return { generationId: existing[0].id, idempotencyKey };
  }

  const modelId = await resolveModelId(input.stage, input.modelId);
  const generationId = uuidv7();

  const write = async (runner: DbTx) => {
    await runner.insert(designGenerations).values({
      id: generationId,
      designId: input.designId,
      stage: input.stage,
      angle: input.angle ?? null,
      colourwayId: input.colourwayId ?? null,
      parentGenerationId: input.parentGenerationId ?? null,
      archetypeId: input.archetypeId ?? null,
      sizeBlockSnapshot: input.sizeBlockSnapshot ?? null,
      provider: "fal",
      modelId,
      promptJson: { ...input.promptJson, sourceImageUrl: input.sourceImageUrl },
      negativePrompt: input.negativePrompt ?? null,
      seed: input.seed ?? null,
      templateVersion: input.templateVersion,
      inputAssetIds: input.inputAssetIds ?? [],
      status: "PENDING",
      idempotencyKey,
    });
    await enqueue("design.generate", { generationId }, runner);
  };

  if (tx) {
    await write(tx);
  } else {
    await db.transaction(write);
  }

  return { generationId, idempotencyKey };
}
