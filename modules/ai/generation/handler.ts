import { eq } from "drizzle-orm";

import { db, designGenerations, designLocks, designs } from "@aks/db";

import { registerHandler } from "@/modules/platform/outbox";
import { transitionDesignStatus } from "@/modules/designs/studio-pipeline";

import { getImageGenProvider } from "../providers";
import { persistGenerationImage } from "./persist-output";

const MAX_PROCESSING_ATTEMPTS = 3;

export async function handleDesignGenerate(
  payload: Record<string, unknown>,
): Promise<void> {
  const generationId = String(payload.generationId ?? "");
  if (!generationId) {
    throw new Error("design.generate payload missing generationId");
  }

  const [row] = await db
    .select()
    .from(designGenerations)
    .where(eq(designGenerations.id, generationId))
    .limit(1);

  if (!row) {
    throw new Error(`design_generations row not found: ${generationId}`);
  }

  if (row.status === "SUCCEEDED" && row.outputAssetId) {
    return;
  }

  if (row.status === "FAILED" && row.processingAttempts >= MAX_PROCESSING_ATTEMPTS) {
    return;
  }

  const attempts = row.processingAttempts + 1;
  await db
    .update(designGenerations)
    .set({ status: "RUNNING", processingAttempts: attempts })
    .where(eq(designGenerations.id, generationId));

  const promptPayload = row.promptJson as Record<string, unknown>;
  const sourceImageUrl = String(promptPayload.sourceImageUrl ?? "");
  const prompt = String(promptPayload.prompt ?? "");
  const started = Date.now();

  try {
    const provider = getImageGenProvider();
    let result;

    if (row.stage === "COLOURWAY") {
      result = await provider.recolour({
        modelId: row.modelId,
        prompt,
        imageUrl: sourceImageUrl,
        seed: row.seed ?? undefined,
      });
    } else {
      result = await provider.sketchToGarment({
        modelId: row.modelId,
        prompt,
        negativePrompt: row.negativePrompt ?? undefined,
        imageUrl: sourceImageUrl,
        seed: row.seed ?? undefined,
      });
    }

    const moderation = await provider.moderate({ imageUrl: result.imageUrl });
    if (!moderation.safe) {
      throw new Error(moderation.reason ?? "Image failed moderation");
    }

    const outputAssetId = await persistGenerationImage({
      generationId,
      imageUrl: result.imageUrl,
    });

    const { calibrateGenerationOutput } = await import(
      "@/modules/ai/studio/sizing/calibrate-generation"
    );
    await calibrateGenerationOutput(generationId, outputAssetId);

    await db
      .update(designGenerations)
      .set({
        status: "SUCCEEDED",
        outputAssetId,
        costUsdMicros: result.costUsdMicros,
        latencyMs: result.latencyMs,
        seed: result.seed ?? row.seed,
        error: null,
      })
      .where(eq(designGenerations.id, generationId));

    if (row.stage === "HERO") {
      const [design] = await db
        .select({ status: designs.status })
        .from(designs)
        .where(eq(designs.id, row.designId))
        .limit(1);

      const promptPayload = row.promptJson as Record<string, unknown>;
      const sizingApply = Boolean(promptPayload.sizingApply);

      if (design?.status === "SIZING_LOCKED" && sizingApply) {
        await db
          .insert(designLocks)
          .values({
            designId: row.designId,
            stage: "HERO",
            generationId,
            lockedBy: "00000000-0000-0000-0000-000000000001",
          })
          .onConflictDoUpdate({
            target: [designLocks.designId, designLocks.stage],
            set: {
              generationId,
              lockedBy: "00000000-0000-0000-0000-000000000001",
              lockedAt: new Date(),
            },
          });
      } else if (design?.status === "HERO_GENERATING") {
        await db.transaction(async (tx) => {
          await transitionDesignStatus({
            designId: row.designId,
            from: "HERO_GENERATING",
            to: "HERO_REVIEW",
            actorId: "00000000-0000-0000-0000-000000000001",
            note: `Hero generation ${generationId} succeeded`,
            tx: tx as never,
          });
        });
      }
    }

    if (row.stage === "ANGLE") {
      const { maybeTransitionToAnglesReview } = await import(
        "@/modules/ai/studio/angles-stage"
      );
      await maybeTransitionToAnglesReview(row.designId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - started;
    const isFinal = attempts >= MAX_PROCESSING_ATTEMPTS;

    await db
      .update(designGenerations)
      .set({
        status: isFinal ? "FAILED" : "PENDING",
        costUsdMicros: 0,
        latencyMs,
        error: message,
      })
      .where(eq(designGenerations.id, generationId));

    if (!isFinal) {
      throw err;
    }

    if (row.stage === "HERO") {
      const [design] = await db
        .select({ status: designs.status })
        .from(designs)
        .where(eq(designs.id, row.designId))
        .limit(1);
      if (design?.status === "HERO_GENERATING") {
        await db.transaction(async (tx) => {
          await transitionDesignStatus({
            designId: row.designId,
            from: "HERO_GENERATING",
            to: "HERO_REVIEW",
            actorId: "00000000-0000-0000-0000-000000000001",
            note: `Hero generation ${generationId} failed: ${message}`,
            tx: tx as never,
          });
        });
      }
    }

    if (row.stage === "ANGLE") {
      const { maybeTransitionToAnglesReview } = await import(
        "@/modules/ai/studio/angles-stage"
      );
      await maybeTransitionToAnglesReview(row.designId);
    }
  }
}

export function registerDesignGenerateHandler(): void {
  registerHandler("design.generate", handleDesignGenerate);
}
