"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  assets,
  colourways,
  db,
  designGenerations,
  designLocks,
  designRenders,
  designs,
  fabrics,
  insertAuditLog,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import type { DesignStatus, RenderAngle } from "@aks/shared";
import { enqueueDesignGeneration } from "@/modules/ai/generation/enqueue";
import {
  getMonthlySpendCapUsdMicros,
  getMonthlySpendUsdMicros,
} from "@/modules/ai/generation/spend-cap";
import { createPresignedReadUrl } from "@/modules/platform/assets";
import { requirePermission } from "@/modules/auth";
import {
  getDesignPipelineStatus,
  transitionDesignStatus,
} from "@/modules/designs/studio-pipeline";

import {
  buildColourwayBatchContexts,
  formatColourwayCostPreview,
  GALLERY_ANGLES,
  resolveLockedGalleryAngles,
  type LockedAngleSource,
} from "./colourway-prompt";

export type ColourwayAngleCell = {
  angle: RenderAngle;
  generationId: string | null;
  status: string | null;
  decision: string | null;
  outputReadUrl: string | null;
  error: string | null;
};

export type ColourwayRow = {
  id: string;
  name: string;
  fabricName: string;
  hexApproximation: string | null;
  isDefault: boolean;
  isApproved: boolean;
  usesLockedAngles: boolean;
  cells: ColourwayAngleCell[];
};

export type ColourwaysPageData = {
  designId: string;
  designName: string;
  status: DesignStatus;
  readOnly: boolean;
  rows: ColourwayRow[];
  pendingColourwayIds: string[];
  costPreview: string | null;
  designSpendUsdMicros: number;
  attemptCount: number;
  monthlySpendUsdMicros: number;
  monthlyCapUsdMicros: number | null;
  isGenerating: boolean;
  canProceedToPublish: boolean;
  fabrics: { id: string; name: string }[];
};

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const COLOURWAYS_ALLOWED: DesignStatus[] = [
  "ANGLES_LOCKED",
  "COLOURWAYS_GENERATING",
  "COLOURWAYS_REVIEW",
  "READY_TO_PUBLISH",
];

const ANGLE_LABEL: Record<RenderAngle, string> = {
  FRONT: "Front",
  THREE_QUARTER: "Three-quarter",
  BACK: "Back",
  DETAIL: "Detail",
};

function revalidateColourways(designId: string) {
  revalidatePath(`/admin/studio/${designId}/colourways`);
  revalidatePath(`/admin/studio/${designId}/publish`);
  revalidatePath(`/admin/studio/${designId}`);
  revalidatePath(`/admin/studio/${designId}/angles`);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function hasPendingColourwayJobs(designId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "COLOURWAY"),
        inArray(designGenerations.status, ["PENDING", "RUNNING"]),
      ),
    );
  return (row?.n ?? 0) > 0;
}

async function latestColourwayGenerations(
  designId: string,
  colourwayId: string,
): Promise<Map<RenderAngle, typeof designGenerations.$inferSelect>> {
  const rows = await db
    .select()
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "COLOURWAY"),
        eq(designGenerations.colourwayId, colourwayId),
        inArray(designGenerations.angle, [...GALLERY_ANGLES]),
      ),
    )
    .orderBy(desc(designGenerations.createdAt));

  const byAngle = new Map<
    RenderAngle,
    typeof designGenerations.$inferSelect
  >();
  for (const row of rows) {
    const angle = row.angle as RenderAngle;
    if (!byAngle.has(angle)) {
      byAngle.set(angle, row);
    }
  }
  return byAngle;
}

async function mapGenerationCell(
  angle: RenderAngle,
  row: (typeof designGenerations.$inferSelect) | null,
): Promise<ColourwayAngleCell> {
  if (!row) {
    return {
      angle,
      generationId: null,
      status: null,
      decision: null,
      outputReadUrl: null,
      error: null,
    };
  }

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
    error: row.error,
  };
}

async function colourwayHasApprovedRenders(
  designId: string,
  colourwayId: string,
): Promise<boolean> {
  const rows = await db
    .select({ angle: designRenders.angle })
    .from(designRenders)
    .where(
      and(
        eq(designRenders.designId, designId),
        eq(designRenders.colourwayId, colourwayId),
        inArray(designRenders.angle, [...GALLERY_ANGLES]),
      ),
    );
  const angles = new Set(rows.map((r) => r.angle));
  return GALLERY_ANGLES.every((a) => angles.has(a));
}

async function buildLockedAngleCells(
  locked: LockedAngleSource[],
): Promise<ColourwayAngleCell[]> {
  return Promise.all(
    locked.map(async (source) => ({
      angle: source.angle,
      generationId: source.generationId,
      status: "SUCCEEDED",
      decision: "APPROVED",
      outputReadUrl: source.imageUrl,
      error: null,
    })),
  );
}

export async function writeDesignRendersForColourway(input: {
  designId: string;
  colourwayId: string;
  designName: string;
  colourwayName: string;
  sources: {
    angle: RenderAngle;
    assetId: string;
    archetypeId: string | null;
  }[];
}): Promise<void> {
  await db
    .delete(designRenders)
    .where(
      and(
        eq(designRenders.designId, input.designId),
        eq(designRenders.colourwayId, input.colourwayId),
      ),
    );

  for (const [index, source] of input.sources.entries()) {
    await db.insert(designRenders).values({
      id: uuidv7(),
      designId: input.designId,
      colourwayId: input.colourwayId,
      angle: source.angle,
      assetId: source.assetId,
      archetypeId: source.archetypeId,
      isAiGenerated: true,
      altText: `${input.designName} — ${input.colourwayName} — ${ANGLE_LABEL[source.angle]}`,
      sortOrder: index,
    });
  }
}

async function resolveSourcesForApproval(
  designId: string,
  colourwayId: string,
  isDefault: boolean,
): Promise<
  { angle: RenderAngle; assetId: string; archetypeId: string | null }[]
> {
  if (isDefault) {
    const locked = await resolveLockedGalleryAngles(designId);
    return locked.map((s) => ({
      angle: s.angle,
      assetId: s.assetId,
      archetypeId: s.archetypeId,
    }));
  }

  const latest = await latestColourwayGenerations(designId, colourwayId);
  const sources: {
    angle: RenderAngle;
    assetId: string;
    archetypeId: string | null;
  }[] = [];

  for (const angle of GALLERY_ANGLES) {
    const row = latest.get(angle);
    if (
      !row ||
      row.status !== "SUCCEEDED" ||
      !row.outputAssetId ||
      row.decision === "REJECTED"
    ) {
      throw new Error(`All three angles must succeed before approving ${angle}.`);
    }
    sources.push({
      angle,
      assetId: row.outputAssetId,
      archetypeId: row.archetypeId,
    });
  }

  return sources;
}

export async function getColourwaysPageData(
  designId: string,
): Promise<ColourwaysPageData | null> {
  await requirePermission("designs.create");

  const [design] = await db
    .select({ id: designs.id, name: designs.name, status: designs.status })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!design) return null;

  const status = design.status as DesignStatus;
  if (!COLOURWAYS_ALLOWED.includes(status)) return null;

  const [angleLock] = await db
    .select()
    .from(designLocks)
    .where(
      and(eq(designLocks.designId, designId), eq(designLocks.stage, "ANGLE")),
    )
    .limit(1);
  if (!angleLock) return null;

  const cwRows = await db
    .select({
      id: colourways.id,
      name: colourways.name,
      hexApproximation: colourways.hexApproximation,
      isDefault: colourways.isDefault,
      fabricName: fabrics.name,
    })
    .from(colourways)
    .innerJoin(fabrics, eq(colourways.fabricId, fabrics.id))
    .where(eq(colourways.designId, designId))
    .orderBy(asc(colourways.sortOrder));

  let lockedCells: ColourwayAngleCell[] | null = null;
  try {
    const locked = await resolveLockedGalleryAngles(designId);
    lockedCells = await buildLockedAngleCells(locked);
  } catch {
    lockedCells = null;
  }

  const rows: ColourwayRow[] = [];
  const pendingColourwayIds: string[] = [];

  for (const cw of cwRows) {
    const approved = await colourwayHasApprovedRenders(designId, cw.id);
    const latest = await latestColourwayGenerations(designId, cw.id);
    const hasGenerations = latest.size > 0;

    let cells: ColourwayAngleCell[];
    if (cw.isDefault && !hasGenerations && lockedCells) {
      cells = lockedCells;
    } else if (hasGenerations) {
      cells = await Promise.all(
        GALLERY_ANGLES.map((angle) =>
          mapGenerationCell(angle, latest.get(angle) ?? null),
        ),
      );
    } else if (lockedCells) {
      cells = lockedCells;
    } else {
      cells = GALLERY_ANGLES.map((angle) => ({
        angle,
        generationId: null,
        status: null,
        decision: null,
        outputReadUrl: null,
        error: null,
      }));
    }

    const usesLockedAngles = cw.isDefault && !hasGenerations;
    if (!usesLockedAngles && !approved && !hasGenerations) {
      pendingColourwayIds.push(cw.id);
    } else if (
      !usesLockedAngles &&
      !approved &&
      hasGenerations &&
      cells.some((c) => c.status !== "SUCCEEDED")
    ) {
      pendingColourwayIds.push(cw.id);
    }

    rows.push({
      id: cw.id,
      name: cw.name,
      fabricName: cw.fabricName,
      hexApproximation: cw.hexApproximation,
      isDefault: cw.isDefault,
      isApproved: approved,
      usesLockedAngles,
      cells,
    });
  }

  const additionalPending = pendingColourwayIds.filter(
    (id) => !cwRows.find((c) => c.id === id)?.isDefault,
  );

  const approvedCount = rows.filter((r) => r.isApproved).length;
  const isGenerating = await hasPendingColourwayJobs(designId);
  const readOnly = status === "READY_TO_PUBLISH";

  const [spendRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${designGenerations.costUsdMicros}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(designGenerations)
    .where(eq(designGenerations.designId, designId));

  const fabricRows = await db
    .select({ id: fabrics.id, name: fabrics.name })
    .from(fabrics)
    .where(eq(fabrics.active, true))
    .orderBy(asc(fabrics.name));

  return {
    designId,
    designName: design.name,
    status,
    readOnly,
    rows,
    pendingColourwayIds: additionalPending,
    costPreview:
      additionalPending.length > 0
        ? formatColourwayCostPreview(additionalPending.length)
        : null,
    designSpendUsdMicros: spendRow?.total ?? 0,
    attemptCount: spendRow?.count ?? 0,
    monthlySpendUsdMicros: await getMonthlySpendUsdMicros(),
    monthlyCapUsdMicros: await getMonthlySpendCapUsdMicros(),
    isGenerating,
    canProceedToPublish: approvedCount >= 1 && !isGenerating,
    fabrics: fabricRows,
  };
}

async function nextColourwayAttemptN(
  designId: string,
  colourwayId: string,
): Promise<number> {
  const prefix = `${designId}:COLOURWAY:`;
  const rows = await db
    .select({ key: designGenerations.idempotencyKey })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.colourwayId, colourwayId),
        eq(designGenerations.stage, "COLOURWAY"),
      ),
    );
  const attemptNs = rows
    .map((r) => {
      const parts = r.key.split(":");
      return Number.parseInt(parts[4] ?? "", 10);
    })
    .filter((n) => Number.isInteger(n));
  return (attemptNs.length ? Math.max(...attemptNs) : 0) + 1;
}

async function enqueueColourwayBatch(
  designId: string,
  colourwayId: string,
  attemptN: number,
  tx?: Parameters<typeof enqueueDesignGeneration>[1],
  options?: {
    angles?: readonly RenderAngle[];
    posePrompt?: string | null;
    manualStudio?: boolean;
  },
): Promise<void> {
  const contexts = await buildColourwayBatchContexts(
    designId,
    colourwayId,
    attemptN,
    options,
  );

  for (const ctx of contexts) {
    await enqueueDesignGeneration(
      {
        designId,
        stage: "COLOURWAY",
        angle: ctx.angle,
        colourwayId: ctx.colourwayId,
        parentGenerationId: ctx.parentGenerationId,
        promptJson: {
          prompt: ctx.prompt,
          batchGroupId: ctx.batchGroupId,
        },
        templateVersion: ctx.templateVersion,
        inputAssetIds: ctx.inputAssetIds,
        sourceImageUrl: ctx.sourceImageUrl,
        seed: ctx.batchSeed,
        attemptN,
        skipHeroLock: Boolean(options?.manualStudio),
      },
      tx,
    );
  }
}

export async function addColourway(payload: {
  designId: string;
  name: string;
  fabricId: string;
  hexApproximation?: string | null;
}): Promise<ActionResult<{ colourwayId: string }>> {
  try {
    const session = await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(payload.designId);
    if (
      status !== "ANGLES_LOCKED" &&
      status !== "COLOURWAYS_REVIEW" &&
      status !== "COLOURWAYS_GENERATING"
    ) {
      return {
        ok: false,
        error: `Cannot add colourways while design is in status "${status ?? "unknown"}".`,
      };
    }

    const name = payload.name.trim();
    if (!name || !payload.fabricId) {
      return { ok: false, error: "Name and fabric are required." };
    }

    const colourwayId = uuidv7();
    const slug = slugify(name);
    const sortRow = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(colourways)
      .where(eq(colourways.designId, payload.designId));
    const sortOrder = sortRow[0]?.n ?? 0;

    await db.insert(colourways).values({
      id: colourwayId,
      designId: payload.designId,
      name,
      slug,
      fabricId: payload.fabricId,
      hexApproximation: payload.hexApproximation?.trim() || null,
      isDefault: false,
      sortOrder,
      active: true,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.colourway.create",
      entityType: "colourway",
      entityId: colourwayId,
      before: null,
      after: { designId: payload.designId, name },
    });

    revalidateColourways(payload.designId);
    return { ok: true, data: { colourwayId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Add colourway failed",
    };
  }
}

export async function generateColourways(payload: {
  designId: string;
  colourwayIds?: string[];
  /** Manual Studio path — allow DRAFT/PUBLISHED when a FRONT reference exists. */
  manualStudio?: boolean;
  includeDefault?: boolean;
  /** Generate only these gallery angles (cost-saving single-slot path). */
  angles?: RenderAngle[];
  /** Commercial pose prompt appended — design + model stay fixed. */
  posePrompt?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(payload.designId);
    const pipelineOk =
      status === "ANGLES_LOCKED" ||
      status === "COLOURWAYS_REVIEW" ||
      status === "COLOURWAYS_GENERATING";
    const manualOk =
      payload.manualStudio &&
      (status === "DRAFT" ||
        status === "PUBLISHED" ||
        status === "READY_TO_PUBLISH");

    if (!pipelineOk && !manualOk) {
      return {
        ok: false,
        error: `Cannot generate colourways while design is in status "${status ?? "unknown"}".`,
      };
    }

    if (manualOk) {
      const front = await db
        .select({ id: designRenders.id })
        .from(designRenders)
        .where(
          and(
            eq(designRenders.designId, payload.designId),
            eq(designRenders.angle, "FRONT"),
          ),
        )
        .limit(1);
      if (!front[0]) {
        return {
          ok: false,
          error: "Upload a FRONT reference photo before generating angles.",
        };
      }
    }

    const allCws = await db
      .select({ id: colourways.id, isDefault: colourways.isDefault })
      .from(colourways)
      .where(eq(colourways.designId, payload.designId));

    let targetIds = payload.colourwayIds?.length
      ? payload.colourwayIds
      : payload.includeDefault || payload.manualStudio
        ? allCws.map((c) => c.id)
        : allCws.filter((c) => !c.isDefault).map((c) => c.id);

    if (!payload.includeDefault && !payload.manualStudio) {
      targetIds = targetIds.filter(
        (id) => !allCws.find((c) => c.id === id)?.isDefault,
      );
    }

    if (targetIds.length === 0) {
      return { ok: false, error: "No colourways to generate." };
    }

    const angleOpts = {
      angles: payload.angles,
      posePrompt: payload.posePrompt,
      manualStudio: Boolean(payload.manualStudio),
    };

    await db.transaction(async (tx) => {
      if (status === "ANGLES_LOCKED" || status === "COLOURWAYS_REVIEW") {
        await transitionDesignStatus({
          designId: payload.designId,
          from: status,
          to: "COLOURWAYS_GENERATING",
          actorId: session.user.id,
          actorRole: session.user.role,
          note: `Generating ${targetIds.length} colourway(s)`,
          tx: tx as never,
        });
      }

      for (const colourwayId of targetIds) {
        const attemptN = await nextColourwayAttemptN(
          payload.designId,
          colourwayId,
        );
        await enqueueColourwayBatch(
          payload.designId,
          colourwayId,
          attemptN,
          tx as never,
          angleOpts,
        );
      }
    });

    revalidateColourways(payload.designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Generation failed",
    };
  }
}

export async function approveColourwaySet(payload: {
  designId: string;
  colourwayId: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(payload.designId);
    if (
      status !== "ANGLES_LOCKED" &&
      status !== "COLOURWAYS_REVIEW" &&
      status !== "COLOURWAYS_GENERATING"
    ) {
      return {
        ok: false,
        error: `Cannot approve colourways while design is in status "${status ?? "unknown"}".`,
      };
    }

    if (await hasPendingColourwayJobs(payload.designId)) {
      return { ok: false, error: "Colourway generation still in progress." };
    }

    const [design] = await db
      .select({ name: designs.name })
      .from(designs)
      .where(eq(designs.id, payload.designId))
      .limit(1);
    if (!design) return { ok: false, error: "Design not found" };

    const [cw] = await db
      .select()
      .from(colourways)
      .where(
        and(
          eq(colourways.id, payload.colourwayId),
          eq(colourways.designId, payload.designId),
        ),
      )
      .limit(1);
    if (!cw) return { ok: false, error: "Colourway not found" };

    const sources = await resolveSourcesForApproval(
      payload.designId,
      payload.colourwayId,
      cw.isDefault,
    );

    if (!cw.isDefault) {
      const latest = await latestColourwayGenerations(
        payload.designId,
        payload.colourwayId,
      );
      for (const row of latest.values()) {
        await db
          .update(designGenerations)
          .set({
            decision: "APPROVED",
            decidedBy: session.user.id,
            decidedAt: new Date(),
          })
          .where(eq(designGenerations.id, row.id));
      }
    }

    await writeDesignRendersForColourway({
      designId: payload.designId,
      colourwayId: payload.colourwayId,
      designName: design.name,
      colourwayName: cw.name,
      sources,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.colourway.approve",
      entityType: "colourway",
      entityId: payload.colourwayId,
      before: null,
      after: { designId: payload.designId, angles: sources.map((s) => s.angle) },
    });

    revalidateColourways(payload.designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Approve failed",
    };
  }
}

export async function skipToPublish(designId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(designId);
    if (status !== "ANGLES_LOCKED") {
      return {
        ok: false,
        error: `Skip is only available from ANGLES_LOCKED (current: ${status ?? "unknown"}).`,
      };
    }

    const [defaultCw] = await db
      .select()
      .from(colourways)
      .where(
        and(eq(colourways.designId, designId), eq(colourways.isDefault, true)),
      )
      .limit(1);
    if (!defaultCw) {
      return { ok: false, error: "Default colourway not found." };
    }

    const [design] = await db
      .select({ name: designs.name })
      .from(designs)
      .where(eq(designs.id, designId))
      .limit(1);
    if (!design) return { ok: false, error: "Design not found" };

    const sources = await resolveSourcesForApproval(
      designId,
      defaultCw.id,
      true,
    );

    await writeDesignRendersForColourway({
      designId,
      colourwayId: defaultCw.id,
      designName: design.name,
      colourwayName: defaultCw.name,
      sources,
    });

    await db.transaction(async (tx) => {
      await transitionDesignStatus({
        designId,
        from: "ANGLES_LOCKED",
        to: "READY_TO_PUBLISH",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: "Skipped colourways — base colourway renders copied",
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.colourways.skip",
      entityType: "design",
      entityId: designId,
      before: { status: "ANGLES_LOCKED" },
      after: { status: "READY_TO_PUBLISH", colourwayId: defaultCw.id },
    });

    revalidateColourways(designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Skip failed",
    };
  }
}

export async function proceedToPublish(designId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(designId);
    if (status !== "COLOURWAYS_REVIEW" && status !== "ANGLES_LOCKED") {
      return {
        ok: false,
        error: `Cannot proceed from status "${status ?? "unknown"}".`,
      };
    }

    if (await hasPendingColourwayJobs(designId)) {
      return { ok: false, error: "Colourway generation still in progress." };
    }

    const cwRows = await db
      .select({ id: colourways.id })
      .from(colourways)
      .where(eq(colourways.designId, designId));

    let approved = 0;
    for (const cw of cwRows) {
      if (await colourwayHasApprovedRenders(designId, cw.id)) approved += 1;
    }
    if (approved < 1) {
      return { ok: false, error: "Approve at least one colourway before publishing." };
    }

    await db.transaction(async (tx) => {
      await transitionDesignStatus({
        designId,
        from: status,
        to: "READY_TO_PUBLISH",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: "Ready to publish",
        tx: tx as never,
      });
    });

    revalidateColourways(designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Proceed failed",
    };
  }
}

export async function pollColourwaysLoop(designId: string): Promise<
  ActionResult<{
    status: DesignStatus;
    isGenerating: boolean;
    rows: ColourwayRow[];
    canProceedToPublish: boolean;
  }>
> {
  try {
    await requirePermission("designs.create");
    const data = await getColourwaysPageData(designId);
    if (!data) return { ok: false, error: "Design not found" };

    return {
      ok: true,
      data: {
        status: data.status,
        isGenerating: data.isGenerating,
        rows: data.rows,
        canProceedToPublish: data.canProceedToPublish,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Poll failed",
    };
  }
}
