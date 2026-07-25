"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  assets,
  db,
  designGenerations,
  designInputs,
  designLocks,
  designs,
  insertAuditLog,
  STUDIO_SETTINGS_SINGLETON_ID,
  studioSettings,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import type { DesignStatus } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { enqueueDesignGeneration } from "@/modules/ai/generation/enqueue";
import {
  getMonthlySpendCapUsdMicros,
  getMonthlySpendUsdMicros,
} from "@/modules/ai/generation/spend-cap";
import { applyNotesToPrompt } from "@/modules/ai/prompts/notes-to-delta";
import { VERIFIED_FAL_MODELS } from "@/modules/ai/providers/fal-models";
import { createPresignedReadUrl } from "@/modules/platform/assets";
import {
  canEnqueueHeroGeneration,
  getDesignPipelineStatus,
  transitionDesignStatus,
} from "@/modules/designs/studio-pipeline";

import { buildHeroPromptContext } from "./hero-prompt";

export type HeroAttemptRow = {
  id: string;
  status: string;
  decision: string;
  modelId: string;
  seed: number | null;
  prompt: string;
  negativePrompt: string | null;
  outputReadUrl: string | null;
  costUsdMicros: number | null;
  error: string | null;
  notes: string | null;
  createdAt: string;
};

export type HeroLoopPageData = {
  designId: string;
  designName: string;
  status: DesignStatus;
  heroLocked: boolean;
  sketchReadUrl: string | null;
  selectedAttemptId: string | null;
  attempts: HeroAttemptRow[];
  prompt: string;
  negativePrompt: string;
  modelId: string;
  modelOptions: { id: string; label: string; jobType: string }[];
  designSpendUsdMicros: number;
  attemptCount: number;
  monthlySpendUsdMicros: number;
  monthlyCapUsdMicros: number | null;
  isGenerating: boolean;
};

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

function revalidateHero(designId: string) {
  revalidatePath(`/admin/studio/${designId}`);
  revalidatePath(`/admin/studio/${designId}/inputs`);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

async function resolveSketchReadUrl(designId: string): Promise<string | null> {
  const rows = await db
    .select({
      assetId: designInputs.assetId,
      derivedAssetId: designInputs.derivedAssetId,
      role: designInputs.role,
    })
    .from(designInputs)
    .where(eq(designInputs.designId, designId));

  const front =
    rows.find((r) => r.role === "SKETCH_FRONT") ??
    rows.find((r) => r.role === "TECHNICAL_FLAT") ??
    rows.find((r) => r.role.startsWith("SKETCH_"));
  if (!front) return null;

  const useAssetId = front.derivedAssetId ?? front.assetId;
  const [asset] = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, useAssetId))
    .limit(1);
  if (!asset) return null;
  return createPresignedReadUrl(asset.r2Key, 3600);
}

async function mapAttempts(designId: string): Promise<HeroAttemptRow[]> {
  const rows = await db
    .select()
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "HERO"),
      ),
    )
    .orderBy(desc(designGenerations.createdAt))
    .limit(20);

  return Promise.all(
    rows.map(async (row) => {
      const promptPayload = row.promptJson as Record<string, unknown>;
      let outputReadUrl: string | null = null;
      if (row.outputAssetId) {
        const [asset] = await db
          .select({ r2Key: assets.r2Key })
          .from(assets)
          .where(eq(assets.id, row.outputAssetId))
          .limit(1);
        if (asset) {
          outputReadUrl = await createPresignedReadUrl(asset.r2Key, 3600);
        }
      }
      return {
        id: row.id,
        status: row.status,
        decision: row.decision,
        modelId: row.modelId,
        seed: row.seed,
        prompt: String(promptPayload.prompt ?? ""),
        negativePrompt: row.negativePrompt,
        outputReadUrl,
        costUsdMicros: row.costUsdMicros,
        error: row.error,
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
      };
    }),
  );
}

export async function ensureInputsUploaded(
  designId: string,
): Promise<DesignStatus> {
  const status = await getDesignPipelineStatus(designId);
  if (!status) throw new Error("Design not found");

  if (status === "DRAFT" || status === "BRIEF_COMPLETE") {
    const session = await requirePermission("designs.create");
    await db.transaction(async (tx) => {
      if (status === "DRAFT") {
        await transitionDesignStatus({
          designId,
          from: "DRAFT",
          to: "BRIEF_COMPLETE",
          actorId: session.user.id,
          actorRole: session.user.role,
          note: "Brief complete — inputs pending",
          tx: tx as never,
        });
      }
      await transitionDesignStatus({
        designId,
        from: "BRIEF_COMPLETE",
        to: "INPUTS_UPLOADED",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: "Inputs ready for hero generation",
        tx: tx as never,
      });
    });
    return "INPUTS_UPLOADED";
  }
  return status;
}

export async function getHeroLoopPageData(
  designId: string,
): Promise<HeroLoopPageData | null> {
  await requirePermission("designs.create");

  const [design] = await db
    .select({ id: designs.id, name: designs.name, status: designs.status })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!design) return null;

  let status = design.status as DesignStatus;
  const inputCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(designInputs)
    .where(eq(designInputs.designId, designId));
  if ((inputCount[0]?.n ?? 0) > 0 && status === "BRIEF_COMPLETE") {
    status = await ensureInputsUploaded(designId);
  }

  const [heroLock] = await db
    .select()
    .from(designLocks)
    .where(
      and(eq(designLocks.designId, designId), eq(designLocks.stage, "HERO")),
    )
    .limit(1);

  const attempts = await mapAttempts(designId);
  const latest = attempts[0] ?? null;
  const selected =
    attempts.find((a) => a.id === heroLock?.generationId) ?? latest;

  let prompt = "";
  let negativePrompt = "";
  try {
    const ctx = await buildHeroPromptContext(designId);
    prompt = ctx.prompt;
    negativePrompt = ctx.negative;
  } catch {
    if (selected) {
      prompt = selected.prompt;
      negativePrompt = selected.negativePrompt ?? "";
    }
  }

  const [settings] = await db
    .select({ models: studioSettings.defaultAiModels })
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  const modelId =
    selected?.modelId ?? settings?.models?.hero ?? VERIFIED_FAL_MODELS.hero;

  const [spendRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${designGenerations.costUsdMicros}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(designGenerations)
    .where(eq(designGenerations.designId, designId));

  const modelOptions = [
    {
      id: VERIFIED_FAL_MODELS.hero,
      label: "Hero (flux-general)",
      jobType: "hero",
    },
    {
      id: VERIFIED_FAL_MODELS.draft,
      label: "Draft (flux/dev)",
      jobType: "draft",
    },
    {
      id: VERIFIED_FAL_MODELS.angle,
      label: "Angle (flux-general)",
      jobType: "angle",
    },
  ];

  const sketchReadUrl = await resolveSketchReadUrl(designId);
  const isGenerating = attempts.some(
    (a) => a.status === "PENDING" || a.status === "RUNNING",
  );

  return {
    designId,
    designName: design.name,
    status,
    heroLocked: Boolean(heroLock),
    sketchReadUrl,
    selectedAttemptId: selected?.id ?? null,
    attempts,
    prompt: selected?.prompt ?? prompt,
    negativePrompt: selected?.negativePrompt ?? negativePrompt,
    modelId,
    modelOptions,
    designSpendUsdMicros: spendRow?.total ?? 0,
    attemptCount: spendRow?.count ?? 0,
    monthlySpendUsdMicros: await getMonthlySpendUsdMicros(),
    monthlyCapUsdMicros: await getMonthlySpendCapUsdMicros(),
    isGenerating,
  };
}

async function enqueueHeroAttempt(input: {
  designId: string;
  prompt: string;
  negativePrompt: string;
  templateVersion: number;
  sourceImageUrl: string;
  inputAssetIds: string[];
  archetypeId: string;
  sizeBlockSnapshot: Record<string, unknown> | null;
  modelId?: string;
  seed?: number | null;
  notes?: string | null;
  promptModifierSource?: string;
}): Promise<string> {
  const session = await requirePermission("designs.create");
  const status = await getDesignPipelineStatus(input.designId);
  if (!status || !canEnqueueHeroGeneration(status)) {
    throw new Error(
      `Cannot generate hero while design is in status "${status ?? "unknown"}".`,
    );
  }

  let generationId = "";

  await db.transaction(async (tx) => {
    if (status === "INPUTS_UPLOADED" || status === "HERO_REVIEW") {
      await transitionDesignStatus({
        designId: input.designId,
        from: status,
        to: "HERO_GENERATING",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: "Hero generation enqueued",
        tx: tx as never,
      });
    }

    const result = await enqueueDesignGeneration(
      {
        designId: input.designId,
        stage: "HERO",
        angle: "FRONT",
        archetypeId: input.archetypeId,
        sizeBlockSnapshot: input.sizeBlockSnapshot,
        modelId: input.modelId,
        promptJson: {
          prompt: input.prompt,
          promptModifierSource: input.promptModifierSource ?? null,
        },
        negativePrompt: input.negativePrompt,
        seed: input.seed ?? randomSeed(),
        templateVersion: input.templateVersion,
        inputAssetIds: input.inputAssetIds,
        sourceImageUrl: input.sourceImageUrl,
      },
      tx as never,
    );
    generationId = result.generationId;

    if (input.notes) {
      await tx
        .update(designGenerations)
        .set({ notes: input.notes })
        .where(eq(designGenerations.id, generationId));
    }
  });

  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "design.hero.enqueue",
    entityType: "design_generation",
    entityId: generationId,
    before: null,
    after: { designId: input.designId, modelId: input.modelId ?? null },
  });

  revalidateHero(input.designId);
  return generationId;
}

export async function startHeroGeneration(
  designId: string,
): Promise<ActionResult<{ generationId: string }>> {
  try {
    await ensureInputsUploaded(designId);
    const ctx = await buildHeroPromptContext(designId);
    const generationId = await enqueueHeroAttempt({
      designId,
      prompt: ctx.prompt,
      negativePrompt: ctx.negative,
      templateVersion: ctx.templateVersion,
      sourceImageUrl: ctx.sourceImageUrl,
      inputAssetIds: ctx.inputAssetIds,
      archetypeId: ctx.archetypeId,
      sizeBlockSnapshot: ctx.sizeBlockSnapshot,
    });
    return { ok: true, data: { generationId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Generation failed",
    };
  }
}

export async function regenerateHeroWithNotes(payload: {
  designId: string;
  attemptId: string;
  notes: string;
  modelId?: string;
}): Promise<ActionResult<{ generationId: string }>> {
  try {
    const notes = payload.notes.trim();
    if (!notes) return { ok: false, error: "Notes are required" };

    const [attempt] = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.id, payload.attemptId))
      .limit(1);
    if (!attempt || attempt.designId !== payload.designId) {
      return { ok: false, error: "Attempt not found" };
    }

    const promptPayload = attempt.promptJson as Record<string, unknown>;
    const basePrompt = String(promptPayload.prompt ?? "");
    const modified = await applyNotesToPrompt({ basePrompt, notes });

    const ctx = await buildHeroPromptContext(payload.designId);
    const generationId = await enqueueHeroAttempt({
      designId: payload.designId,
      prompt: modified.resolvedPrompt,
      negativePrompt: attempt.negativePrompt ?? ctx.negative,
      templateVersion: attempt.templateVersion,
      sourceImageUrl: ctx.sourceImageUrl,
      inputAssetIds: ctx.inputAssetIds,
      archetypeId: attempt.archetypeId ?? ctx.archetypeId,
      sizeBlockSnapshot: attempt.sizeBlockSnapshot,
      modelId: payload.modelId ?? attempt.modelId,
      notes,
      promptModifierSource: modified.source,
    });
    return { ok: true, data: { generationId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Regeneration failed",
    };
  }
}

export async function regenerateHeroSameSeed(payload: {
  designId: string;
  attemptId: string;
  prompt: string;
  modelId?: string;
}): Promise<ActionResult<{ generationId: string }>> {
  try {
    const prompt = payload.prompt.trim();
    if (!prompt) return { ok: false, error: "Prompt is required" };

    const [attempt] = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.id, payload.attemptId))
      .limit(1);
    if (!attempt || attempt.designId !== payload.designId) {
      return { ok: false, error: "Attempt not found" };
    }
    if (attempt.seed == null) {
      return { ok: false, error: "Previous attempt has no seed to reuse" };
    }

    const ctx = await buildHeroPromptContext(payload.designId);
    const generationId = await enqueueHeroAttempt({
      designId: payload.designId,
      prompt,
      negativePrompt: attempt.negativePrompt ?? ctx.negative,
      templateVersion: attempt.templateVersion,
      sourceImageUrl: ctx.sourceImageUrl,
      inputAssetIds: ctx.inputAssetIds,
      archetypeId: attempt.archetypeId ?? ctx.archetypeId,
      sizeBlockSnapshot: attempt.sizeBlockSnapshot,
      modelId: payload.modelId ?? attempt.modelId,
      seed: attempt.seed,
    });
    return { ok: true, data: { generationId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Regeneration failed",
    };
  }
}

export async function switchModelAndRegenerate(payload: {
  designId: string;
  attemptId: string;
  modelId: string;
}): Promise<ActionResult<{ generationId: string }>> {
  try {
    const [attempt] = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.id, payload.attemptId))
      .limit(1);
    if (!attempt || attempt.designId !== payload.designId) {
      return { ok: false, error: "Attempt not found" };
    }

    const promptPayload = attempt.promptJson as Record<string, unknown>;
    const ctx = await buildHeroPromptContext(payload.designId);
    const generationId = await enqueueHeroAttempt({
      designId: payload.designId,
      prompt: String(promptPayload.prompt ?? ""),
      negativePrompt: attempt.negativePrompt ?? ctx.negative,
      templateVersion: attempt.templateVersion,
      sourceImageUrl: ctx.sourceImageUrl,
      inputAssetIds: ctx.inputAssetIds,
      archetypeId: attempt.archetypeId ?? ctx.archetypeId,
      sizeBlockSnapshot: attempt.sizeBlockSnapshot,
      modelId: payload.modelId,
    });
    return { ok: true, data: { generationId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Model switch failed",
    };
  }
}

export async function rejectHeroAttempt(payload: {
  designId: string;
  attemptId: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");

    const [attempt] = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.id, payload.attemptId))
      .limit(1);
    if (!attempt || attempt.designId !== payload.designId) {
      return { ok: false, error: "Attempt not found" };
    }

    await db
      .update(designGenerations)
      .set({
        decision: "REJECTED",
        decidedBy: session.user.id,
        decidedAt: new Date(),
      })
      .where(eq(designGenerations.id, payload.attemptId));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.hero.reject",
      entityType: "design_generation",
      entityId: payload.attemptId,
      before: { decision: attempt.decision },
      after: { decision: "REJECTED" },
    });

    revalidateHero(payload.designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reject failed",
    };
  }
}

export async function approveHeroAttempt(payload: {
  designId: string;
  attemptId: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");

    const [attempt] = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.id, payload.attemptId))
      .limit(1);
    if (!attempt || attempt.designId !== payload.designId) {
      return { ok: false, error: "Attempt not found" };
    }
    if (attempt.status !== "SUCCEEDED" || !attempt.outputAssetId) {
      return { ok: false, error: "Only succeeded generations can be approved" };
    }

    const status = await getDesignPipelineStatus(payload.designId);
    if (status !== "HERO_REVIEW") {
      return {
        ok: false,
        error: `Cannot approve hero while design is in status "${status ?? "unknown"}".`,
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(designGenerations)
        .set({
          decision: "APPROVED",
          decidedBy: session.user.id,
          decidedAt: new Date(),
        })
        .where(eq(designGenerations.id, payload.attemptId));

      await tx
        .insert(designLocks)
        .values({
          designId: payload.designId,
          stage: "HERO",
          generationId: payload.attemptId,
          lockedBy: session.user.id,
        })
        .onConflictDoUpdate({
          target: [designLocks.designId, designLocks.stage],
          set: {
            generationId: payload.attemptId,
            lockedBy: session.user.id,
            lockedAt: new Date(),
          },
        });

      await transitionDesignStatus({
        designId: payload.designId,
        from: "HERO_REVIEW",
        to: "HERO_LOCKED",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: `Hero approved (${payload.attemptId})`,
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.hero.approve",
      entityType: "design_generation",
      entityId: payload.attemptId,
      before: null,
      after: { designId: payload.designId, locked: true },
    });

    revalidateHero(payload.designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Approve failed",
    };
  }
}

export async function pollHeroLoop(designId: string): Promise<
  ActionResult<{
    status: DesignStatus;
    isGenerating: boolean;
    attempts: HeroAttemptRow[];
    designSpendUsdMicros: number;
    attemptCount: number;
  }>
> {
  try {
    await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(designId);
    if (!status) return { ok: false, error: "Design not found" };

    const attempts = await mapAttempts(designId);
    const isGenerating = attempts.some(
      (a) => a.status === "PENDING" || a.status === "RUNNING",
    );

    const [spendRow] = await db
      .select({
        total: sql<number>`coalesce(sum(${designGenerations.costUsdMicros}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(designGenerations)
      .where(eq(designGenerations.designId, designId));

    return {
      ok: true,
      data: {
        status,
        isGenerating,
        attempts,
        designSpendUsdMicros: spendRow?.total ?? 0,
        attemptCount: spendRow?.count ?? 0,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Poll failed",
    };
  }
}
