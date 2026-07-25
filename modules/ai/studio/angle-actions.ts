"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  assets,
  db,
  designGenerations,
  designLocks,
  designs,
  insertAuditLog,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import type { DesignStatus, RenderAngle } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { enqueueDesignGeneration } from "@/modules/ai/generation/enqueue";
import { applyNotesToPrompt } from "@/modules/ai/prompts/notes-to-delta";
import {
  getMonthlySpendCapUsdMicros,
  getMonthlySpendUsdMicros,
} from "@/modules/ai/generation/spend-cap";
import { createPresignedReadUrl } from "@/modules/platform/assets";
import {
  getDesignPipelineStatus,
  transitionDesignStatus,
} from "@/modules/designs/studio-pipeline";

import {
  buildAnglePromptContext,
  buildAnglePromptContexts,
  type AnglePromptContext,
  type AngleTarget,
} from "./angle-prompt";

export type AngleSlot = {
  angle: RenderAngle;
  generationId: string | null;
  status: string | null;
  decision: string | null;
  outputReadUrl: string | null;
  sourceLabel: string | null;
  notes: string | null;
  error: string | null;
  isMaster?: boolean;
};

export type AnglesPageData = {
  designId: string;
  designName: string;
  status: DesignStatus;
  readOnly: boolean;
  heroLocked: boolean;
  slots: AngleSlot[];
  designSpendUsdMicros: number;
  attemptCount: number;
  monthlySpendUsdMicros: number;
  monthlyCapUsdMicros: number | null;
  isGenerating: boolean;
  canLock: boolean;
};

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const ANGLE_TARGETS: AngleTarget[] = ["THREE_QUARTER", "BACK"];

const ANGLES_ALLOWED: DesignStatus[] = [
  "SIZING_LOCKED",
  "ANGLES_GENERATING",
  "ANGLES_REVIEW",
  "ANGLES_LOCKED",
];

function revalidateAngles(designId: string) {
  revalidatePath(`/admin/studio/${designId}/angles`);
  revalidatePath(`/admin/studio/${designId}`);
  revalidatePath(`/admin/studio/${designId}/sizing`);
}

async function resolveHeroReadUrl(designId: string): Promise<{
  generationId: string;
  readUrl: string;
} | null> {
  const [heroLock] = await db
    .select({ generationId: designLocks.generationId })
    .from(designLocks)
    .where(
      and(eq(designLocks.designId, designId), eq(designLocks.stage, "HERO")),
    )
    .limit(1);
  if (!heroLock) return null;

  const [gen] = await db
    .select({ outputAssetId: designGenerations.outputAssetId })
    .from(designGenerations)
    .where(eq(designGenerations.id, heroLock.generationId))
    .limit(1);
  if (!gen?.outputAssetId) return null;

  const [asset] = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, gen.outputAssetId))
    .limit(1);
  if (!asset) return null;

  const readUrl = await createPresignedReadUrl(asset.r2Key, 3600);
  return { generationId: heroLock.generationId, readUrl };
}

async function latestAngleGenerations(
  designId: string,
): Promise<Map<AngleTarget, (typeof designGenerations.$inferSelect)>> {
  const rows = await db
    .select()
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "ANGLE"),
        inArray(designGenerations.angle, ANGLE_TARGETS),
      ),
    )
    .orderBy(desc(designGenerations.createdAt));

  const byAngle = new Map<AngleTarget, (typeof designGenerations.$inferSelect)>();
  for (const row of rows) {
    const angle = row.angle as AngleTarget;
    if (!byAngle.has(angle)) {
      byAngle.set(angle, row);
    }
  }
  return byAngle;
}

async function mapGenerationToSlot(
  angle: RenderAngle,
  row: (typeof designGenerations.$inferSelect) | null,
  extra?: Partial<AngleSlot>,
): Promise<AngleSlot> {
  if (!row) {
    return {
      angle,
      generationId: null,
      status: null,
      decision: null,
      outputReadUrl: null,
      sourceLabel: null,
      notes: null,
      error: null,
      ...extra,
    };
  }

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
    angle,
    generationId: row.id,
    status: row.status,
    decision: row.decision,
    outputReadUrl,
    sourceLabel: String(promptPayload.sourceLabel ?? ""),
    notes: row.notes,
    error: row.error,
    ...extra,
  };
}

async function hasPendingAngleJobs(designId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "ANGLE"),
        inArray(designGenerations.status, ["PENDING", "RUNNING"]),
      ),
    );
  return (row?.n ?? 0) > 0;
}

async function enqueueAngleGeneration(
  ctx: AnglePromptContext,
  designId: string,
  tx?: Parameters<typeof enqueueDesignGeneration>[1],
  notes?: string | null,
): Promise<string> {
  const result = await enqueueDesignGeneration(
    {
      designId,
      stage: "ANGLE",
      angle: ctx.angle,
      parentGenerationId: ctx.parentGenerationId,
      archetypeId: ctx.archetypeId,
      sizeBlockSnapshot: ctx.sizeBlockSnapshot,
      promptJson: {
        prompt: ctx.prompt,
        sourceMode: ctx.sourceMode,
        sourceLabel: ctx.sourceLabel,
        heroImageUrl: ctx.heroImageUrl,
      },
      negativePrompt: ctx.negative,
      templateVersion: ctx.templateVersion,
      inputAssetIds: ctx.inputAssetIds,
      sourceImageUrl: ctx.sourceImageUrl,
    },
    tx,
  );

  if (notes) {
    const runner = tx ?? db;
    await runner
      .update(designGenerations)
      .set({ notes })
      .where(eq(designGenerations.id, result.generationId));
  }

  return result.generationId;
}

export async function ensureAnglesGenerating(
  designId: string,
): Promise<DesignStatus> {
  const session = await requirePermission("designs.create");
  const status = await getDesignPipelineStatus(designId);
  if (!status) throw new Error("Design not found");

  if (status === "SIZING_LOCKED") {
    const contexts = await buildAnglePromptContexts(designId);
    await db.transaction(async (tx) => {
      await transitionDesignStatus({
        designId,
        from: "SIZING_LOCKED",
        to: "ANGLES_GENERATING",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: "Angle generation started",
        tx: tx as never,
      });

      for (const ctx of contexts) {
        await enqueueAngleGeneration(ctx, designId, tx as never);
      }
    });
    return "ANGLES_GENERATING";
  }

  return status;
}

export async function getAnglesPageData(
  designId: string,
): Promise<AnglesPageData | null> {
  await requirePermission("designs.create");

  const [design] = await db
    .select({ id: designs.id, name: designs.name, status: designs.status })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!design) return null;

  const status = design.status as DesignStatus;
  if (!ANGLES_ALLOWED.includes(status)) return null;

  let currentStatus = status;
  if (status === "SIZING_LOCKED") {
    currentStatus = await ensureAnglesGenerating(designId);
  }

  const hero = await resolveHeroReadUrl(designId);
  if (!hero) return null;

  const [heroLock] = await db
    .select()
    .from(designLocks)
    .where(
      and(eq(designLocks.designId, designId), eq(designLocks.stage, "HERO")),
    )
    .limit(1);

  const latest = await latestAngleGenerations(designId);
  const threeQuarter = await mapGenerationToSlot(
    "THREE_QUARTER",
    latest.get("THREE_QUARTER") ?? null,
  );
  const back = await mapGenerationToSlot(
    "BACK",
    latest.get("BACK") ?? null,
  );

  const heroSlot: AngleSlot = {
    angle: "FRONT",
    generationId: hero.generationId,
    status: "SUCCEEDED",
    decision: "APPROVED",
    outputReadUrl: hero.readUrl,
    sourceLabel: "front: master hero",
    notes: null,
    error: null,
    isMaster: true,
  };

  const isGenerating = await hasPendingAngleJobs(designId);
  const readOnly = currentStatus === "ANGLES_LOCKED";

  const canLock =
    currentStatus === "ANGLES_REVIEW" &&
    !isGenerating &&
    threeQuarter.decision === "APPROVED" &&
    back.decision === "APPROVED";

  const [spendRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${designGenerations.costUsdMicros}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(designGenerations)
    .where(eq(designGenerations.designId, designId));

  return {
    designId,
    designName: design.name,
    status: currentStatus,
    readOnly,
    heroLocked: Boolean(heroLock),
    slots: [heroSlot, threeQuarter, back],
    designSpendUsdMicros: spendRow?.total ?? 0,
    attemptCount: spendRow?.count ?? 0,
    monthlySpendUsdMicros: await getMonthlySpendUsdMicros(),
    monthlyCapUsdMicros: await getMonthlySpendCapUsdMicros(),
    isGenerating,
    canLock,
  };
}

export async function approveAngleAttempt(payload: {
  designId: string;
  generationId: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");

    const [attempt] = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.id, payload.generationId))
      .limit(1);
    if (!attempt || attempt.designId !== payload.designId) {
      return { ok: false, error: "Generation not found" };
    }
    if (attempt.stage !== "ANGLE") {
      return { ok: false, error: "Not an angle generation" };
    }
    if (attempt.status !== "SUCCEEDED" || !attempt.outputAssetId) {
      return { ok: false, error: "Only succeeded generations can be approved" };
    }

    const status = await getDesignPipelineStatus(payload.designId);
    if (status !== "ANGLES_REVIEW") {
      return {
        ok: false,
        error: `Cannot approve angles while design is in status "${status ?? "unknown"}".`,
      };
    }

    await db
      .update(designGenerations)
      .set({
        decision: "APPROVED",
        decidedBy: session.user.id,
        decidedAt: new Date(),
      })
      .where(eq(designGenerations.id, payload.generationId));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.angle.approve",
      entityType: "design_generation",
      entityId: payload.generationId,
      before: { decision: attempt.decision },
      after: { decision: "APPROVED", angle: attempt.angle },
    });

    revalidateAngles(payload.designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Approve failed",
    };
  }
}

export async function rejectAngleAttempt(payload: {
  designId: string;
  generationId: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");

    const [attempt] = await db
      .select()
      .from(designGenerations)
      .where(eq(designGenerations.id, payload.generationId))
      .limit(1);
    if (!attempt || attempt.designId !== payload.designId) {
      return { ok: false, error: "Generation not found" };
    }
    if (attempt.stage !== "ANGLE") {
      return { ok: false, error: "Not an angle generation" };
    }

    await db
      .update(designGenerations)
      .set({
        decision: "REJECTED",
        decidedBy: session.user.id,
        decidedAt: new Date(),
      })
      .where(eq(designGenerations.id, payload.generationId));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.angle.reject",
      entityType: "design_generation",
      entityId: payload.generationId,
      before: { decision: attempt.decision },
      after: { decision: "REJECTED", angle: attempt.angle },
    });

    revalidateAngles(payload.designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reject failed",
    };
  }
}

export async function regenerateAngleWithNotes(payload: {
  designId: string;
  angle: AngleTarget;
  notes: string;
}): Promise<ActionResult<{ generationId: string }>> {
  try {
    const session = await requirePermission("designs.create");
    const notes = payload.notes.trim();
    if (!notes) return { ok: false, error: "Notes are required" };

    const status = await getDesignPipelineStatus(payload.designId);
    if (status !== "ANGLES_REVIEW" && status !== "ANGLES_GENERATING") {
      return {
        ok: false,
        error: `Cannot regenerate angles while design is in status "${status ?? "unknown"}".`,
      };
    }

    const ctx = await buildAnglePromptContext(payload.designId, payload.angle);
    const modified = await applyNotesToPrompt({
      basePrompt: ctx.prompt,
      notes,
    });

    let generationId = "";

    await db.transaction(async (tx) => {
      if (status === "ANGLES_REVIEW") {
        await transitionDesignStatus({
          designId: payload.designId,
          from: "ANGLES_REVIEW",
          to: "ANGLES_GENERATING",
          actorId: session.user.id,
          actorRole: session.user.role,
          note: `Regenerating ${payload.angle} with notes`,
          tx: tx as never,
        });
      }

      generationId = await enqueueAngleGeneration(
        { ...ctx, prompt: modified.resolvedPrompt },
        payload.designId,
        tx as never,
        notes,
      );
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.angle.regenerate",
      entityType: "design_generation",
      entityId: generationId,
      before: null,
      after: {
        designId: payload.designId,
        angle: payload.angle,
        parentGenerationId: ctx.parentGenerationId,
      },
    });

    revalidateAngles(payload.designId);
    return { ok: true, data: { generationId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Regeneration failed",
    };
  }
}

export async function lockAngles(designId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(designId);
    if (status !== "ANGLES_REVIEW") {
      return {
        ok: false,
        error: `Cannot lock angles while design is in status "${status ?? "unknown"}".`,
      };
    }

    if (await hasPendingAngleJobs(designId)) {
      return { ok: false, error: "Angle generation still in progress" };
    }

    const hero = await resolveHeroReadUrl(designId);
    if (!hero) {
      return { ok: false, error: "Hero must be locked before locking angles" };
    }

    const latest = await latestAngleGenerations(designId);
    const approved: string[] = [];

    for (const angle of ANGLE_TARGETS) {
      const row = latest.get(angle);
      if (!row || row.decision !== "APPROVED" || row.status !== "SUCCEEDED") {
        return {
          ok: false,
          error: `Approve ${angle.replace("_", " ").toLowerCase()} before locking.`,
        };
      }
      approved.push(row.id);
    }

    await db.transaction(async (tx) => {
      await tx
        .insert(designLocks)
        .values({
          designId,
          stage: "ANGLE",
          generationId: hero.generationId,
          lockedBy: session.user.id,
        })
        .onConflictDoUpdate({
          target: [designLocks.designId, designLocks.stage],
          set: {
            generationId: hero.generationId,
            lockedBy: session.user.id,
            lockedAt: new Date(),
          },
        });

      await transitionDesignStatus({
        designId,
        from: "ANGLES_REVIEW",
        to: "ANGLES_LOCKED",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: `Angles locked (${approved.join(", ")})`,
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.angles.lock",
      entityType: "design",
      entityId: designId,
      before: { status: "ANGLES_REVIEW" },
      after: {
        status: "ANGLES_LOCKED",
        approvedGenerations: approved,
        heroGenerationId: hero.generationId,
      },
    });

    revalidateAngles(designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Lock failed",
    };
  }
}

export async function pollAnglesLoop(designId: string): Promise<
  ActionResult<{
    status: DesignStatus;
    isGenerating: boolean;
    slots: AngleSlot[];
    canLock: boolean;
  }>
> {
  try {
    await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(designId);
    if (!status) return { ok: false, error: "Design not found" };

    const hero = await resolveHeroReadUrl(designId);
    if (!hero) return { ok: false, error: "Hero not found" };

    const latest = await latestAngleGenerations(designId);
    const threeQuarter = await mapGenerationToSlot(
      "THREE_QUARTER",
      latest.get("THREE_QUARTER") ?? null,
    );
    const back = await mapGenerationToSlot(
      "BACK",
      latest.get("BACK") ?? null,
    );

    const heroSlot: AngleSlot = {
      angle: "FRONT",
      generationId: hero.generationId,
      status: "SUCCEEDED",
      decision: "APPROVED",
      outputReadUrl: hero.readUrl,
      sourceLabel: "front: master hero",
      notes: null,
      error: null,
      isMaster: true,
    };

    const isGenerating = await hasPendingAngleJobs(designId);
    const canLock =
      status === "ANGLES_REVIEW" &&
      !isGenerating &&
      threeQuarter.decision === "APPROVED" &&
      back.decision === "APPROVED";

    return {
      ok: true,
      data: {
        status,
        isGenerating,
        slots: [heroSlot, threeQuarter, back],
        canLock,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Poll failed",
    };
  }
}

