"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  assets,
  db,
  designGenerations,
  designLocks,
  designs,
  garmentCategories,
  houseModels,
  insertAuditLog,
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
  STUDIO_SETTINGS_SINGLETON_ID,
  studioSettings,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import type { DesignStatus } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { enqueueDesignGeneration } from "@/modules/ai/generation/enqueue";
import { resolveChart } from "@/modules/sizing/engine";
import type { SizeBlockDetail } from "@/modules/sizing/block-actions";
import { getSizeBlock } from "@/modules/sizing/block-actions";
import {
  getDesignPipelineStatus,
  transitionDesignStatus,
} from "@/modules/designs/studio-pipeline";
import { createPresignedReadUrl } from "@/modules/platform/assets";
import { formatMeasure } from "@/modules/ui";

import { buildHeroPromptContext } from "./hero-prompt";
import { calibrateGenerationOutput } from "./sizing/calibrate-generation";
import {
  computeOverlayLines,
  type OverlayGuideLine,
} from "./sizing/overlay-math";
import { resolveAnchorYBpByKey } from "./sizing/resolve-anchors";

export type SizingPageData = {
  designId: string;
  designName: string;
  status: DesignStatus;
  readOnly: boolean;
  heroReadUrl: string;
  imageWidthPx: number;
  imageHeightPx: number;
  modelPixelHeight: number;
  modelHeightDetection: string;
  archetypeHeightInches: number;
  baseSizeLabel: string;
  block: SizeBlockDetail;
  overlayLines: OverlayGuideLine[];
  anchorYBpByKey: Record<string, number>;
  hasFork: boolean;
};

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

function revalidateSizing(designId: string) {
  revalidatePath(`/admin/studio/${designId}/sizing`);
  revalidatePath(`/admin/studio/${designId}`);
}

async function resolveDesignBlockId(designId: string): Promise<{
  blockId: string | null;
  categoryKey: string;
  components: string[];
}> {
  const [design] = await db
    .select({
      sizeBlockId: designs.sizeBlockId,
      components: designs.components,
      categoryKey: garmentCategories.key,
    })
    .from(designs)
    .innerJoin(garmentCategories, eq(designs.garmentTypeId, garmentCategories.id))
    .where(eq(designs.id, designId))
    .limit(1);

  if (!design?.sizeBlockId) {
    return {
      blockId: null,
      categoryKey: design?.categoryKey ?? "KAMEEZ",
      components: (design?.components as string[]) ?? [],
    };
  }

  const fork = await db
    .select({ id: sizeBlocks.id })
    .from(sizeBlocks)
    .where(
      and(
        eq(sizeBlocks.ownerDesignId, designId),
        eq(sizeBlocks.active, true),
      ),
    )
    .limit(1);

  return {
    blockId: fork[0]?.id ?? design.sizeBlockId,
    categoryKey: design.categoryKey,
    components: (design.components as string[]) ?? [],
  };
}

async function resolveLockedHeroGeneration(designId: string) {
  const [heroLock] = await db
    .select({ generationId: designLocks.generationId })
    .from(designLocks)
    .where(
      and(eq(designLocks.designId, designId), eq(designLocks.stage, "HERO")),
    )
    .limit(1);
  if (!heroLock) return null;

  const [gen] = await db
    .select()
    .from(designGenerations)
    .where(eq(designGenerations.id, heroLock.generationId))
    .limit(1);
  return gen ?? null;
}

function buildSizeBlockSnapshot(
  block: SizeBlockDetail,
  grid: ReturnType<typeof resolveChart>,
): Record<string, unknown> {
  const baseValues: Record<string, number> = {};
  for (const row of block.rows) {
    baseValues[row.measurementKey] =
      grid[row.measurementKey]?.[block.baseSizeLabel]?.value ?? row.baseValue;
  }
  return {
    blockId: block.id,
    baseSizeLabel: block.baseSizeLabel,
    baseValues,
  };
}

export async function ensureSizingStage(designId: string): Promise<DesignStatus> {
  const session = await requirePermission("designs.create");
  const status = await getDesignPipelineStatus(designId);
  if (!status) throw new Error("Design not found");

  if (status === "HERO_LOCKED") {
    await db.transaction(async (tx) => {
      await transitionDesignStatus({
        designId,
        from: "HERO_LOCKED",
        to: "SIZING",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: "Sizing overlay opened",
        tx: tx as never,
      });
    });
    return "SIZING";
  }

  return status;
}

export async function getSizingPageData(
  designId: string,
): Promise<SizingPageData | null> {
  await requirePermission("designs.create");

  const [design] = await db
    .select({ id: designs.id, name: designs.name, status: designs.status })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!design) return null;

  const allowed: DesignStatus[] = ["HERO_LOCKED", "SIZING", "SIZING_LOCKED"];
  const status = design.status as DesignStatus;
  if (!allowed.includes(status)) return null;

  if (status === "HERO_LOCKED") {
    await ensureSizingStage(designId);
  }

  const heroGen = await resolveLockedHeroGeneration(designId);
  if (!heroGen?.outputAssetId) return null;

  let outputMeta = heroGen.outputMeta;
  if (!outputMeta?.modelPixelHeight) {
    await calibrateGenerationOutput(heroGen.id, heroGen.outputAssetId);
    const [refreshed] = await db
      .select({ outputMeta: designGenerations.outputMeta })
      .from(designGenerations)
      .where(eq(designGenerations.id, heroGen.id))
      .limit(1);
    outputMeta = refreshed?.outputMeta ?? outputMeta;
  }

  const [asset] = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, heroGen.outputAssetId))
    .limit(1);
  if (!asset) return null;

  const heroReadUrl = await createPresignedReadUrl(asset.r2Key, 3600);

  const { blockId, categoryKey, components } =
    await resolveDesignBlockId(designId);
  if (!blockId) return null;

  const block = await getSizeBlock(blockId, { designId });
  if (!block) return null;

  const [settings] = await db
    .select({ archetypeId: studioSettings.defaultArchetypeId })
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  const archetypeId = heroGen.archetypeId ?? settings?.archetypeId;
  if (!archetypeId) return null;

  const [archetype] = await db
    .select({ heightInches: houseModels.heightInches })
    .from(houseModels)
    .where(eq(houseModels.id, archetypeId))
    .limit(1);
  if (!archetype) return null;

  const grid = resolveChart(
    { sizeLabels: block.sizeLabels, baseSizeLabel: block.baseSizeLabel },
    block.rows.map((r) => ({
      measurementKey: r.measurementKey,
      baseValue: r.baseValue,
      gradeIncrement: r.gradeIncrement,
      gradeOverrides: r.gradeOverrides,
    })),
    block.pinnedCells.map((p) => ({
      measurementKey: p.measurementKey,
      sizeLabel: p.sizeLabel,
      value: p.value,
    })),
  );

  const valuesByKey: Record<string, number> = {};
  for (const row of block.rows) {
    valuesByKey[row.measurementKey] =
      grid[row.measurementKey]?.[block.baseSizeLabel]?.value ?? row.baseValue;
  }

  const anchorYBpByKey = await resolveAnchorYBpByKey({
    archetypeId,
    categoryKeys: [categoryKey, ...components],
    measurementKeys: block.rows.map((r) => r.measurementKey),
  });

  const imageHeightPx = outputMeta?.imageHeightPx ?? 1024;
  const modelPixelHeight =
    outputMeta?.modelPixelHeight ??
    Math.round((imageHeightPx * 8800) / 10_000);

  const overlayLines = computeOverlayLines({
    imageHeightPx,
    modelPixelHeight,
    archetypeHeightInches: archetype.heightInches,
    anchorYBpByKey,
    valuesByKey,
    formatValue: (v) => formatMeasure(v, "in"),
  });

  const currentStatus =
    (await getDesignPipelineStatus(designId)) ?? (status as DesignStatus);

  return {
    designId,
    designName: design.name,
    status: currentStatus,
    readOnly: currentStatus === "SIZING_LOCKED",
    heroReadUrl,
    imageWidthPx: outputMeta?.imageWidthPx ?? 768,
    imageHeightPx,
    modelPixelHeight,
    modelHeightDetection: outputMeta?.modelHeightDetection ?? "fallback_fraction",
    archetypeHeightInches: archetype.heightInches,
    baseSizeLabel: block.baseSizeLabel,
    block,
    overlayLines,
    anchorYBpByKey,
    hasFork: Boolean(block.ownerDesignId),
  };
}

export async function skipSizing(designId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(designId);
    if (status !== "SIZING") {
      return {
        ok: false,
        error: `Cannot skip sizing while design is in status "${status ?? "unknown"}".`,
      };
    }

    await db.transaction(async (tx) => {
      await transitionDesignStatus({
        designId,
        from: "SIZING",
        to: "SIZING_LOCKED",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: "Skipped — standard chart unchanged",
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.sizing.skip",
      entityType: "design",
      entityId: designId,
      before: { status: "SIZING" },
      after: { status: "SIZING_LOCKED", regenerated: false },
    });

    revalidateSizing(designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Skip failed",
    };
  }
}

export async function applySizing(designId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("designs.create");
    const status = await getDesignPipelineStatus(designId);
    if (status !== "SIZING") {
      return {
        ok: false,
        error: `Cannot apply sizing while design is in status "${status ?? "unknown"}".`,
      };
    }

    const heroGen = await resolveLockedHeroGeneration(designId);
    if (!heroGen) {
      return { ok: false, error: "Locked hero not found" };
    }

    const { blockId } = await resolveDesignBlockId(designId);
    if (!blockId) {
      return { ok: false, error: "Design has no size block" };
    }

    const block = await getSizeBlock(blockId, { designId });
    if (!block) return { ok: false, error: "Size block not found" };

    const grid = resolveChart(
      { sizeLabels: block.sizeLabels, baseSizeLabel: block.baseSizeLabel },
      block.rows.map((r) => ({
        measurementKey: r.measurementKey,
        baseValue: r.baseValue,
        gradeIncrement: r.gradeIncrement,
        gradeOverrides: r.gradeOverrides,
      })),
      block.pinnedCells.map((p) => ({
        measurementKey: p.measurementKey,
        sizeLabel: p.sizeLabel,
        value: p.value,
      })),
    );

    const sizeBlockSnapshot = buildSizeBlockSnapshot(block, grid);
    const ctx = await buildHeroPromptContext(designId);

    let generationId = "";

    await db.transaction(async (tx) => {
      if (block.ownerDesignId === designId) {
        await tx
          .update(designs)
          .set({ sizeBlockId: block.id, updatedAt: new Date() })
          .where(eq(designs.id, designId));
      }

      const result = await enqueueDesignGeneration(
        {
          designId,
          stage: "HERO",
          angle: "FRONT",
          parentGenerationId: heroGen.id,
          archetypeId: heroGen.archetypeId ?? ctx.archetypeId,
          sizeBlockSnapshot,
          modelId: heroGen.modelId,
          promptJson: {
            prompt: ctx.prompt,
            sourceImageUrl: ctx.sourceImageUrl,
            sizingApply: true,
          },
          negativePrompt: ctx.negative,
          seed: heroGen.seed,
          templateVersion: ctx.templateVersion,
          inputAssetIds: ctx.inputAssetIds,
          sourceImageUrl: ctx.sourceImageUrl,
        },
        tx as never,
      );
      generationId = result.generationId;

      await transitionDesignStatus({
        designId,
        from: "SIZING",
        to: "SIZING_LOCKED",
        actorId: session.user.id,
        actorRole: session.user.role,
        note: `Sizing applied — hero regeneration ${generationId}`,
        tx: tx as never,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "design.sizing.apply",
      entityType: "design",
      entityId: designId,
      before: { status: "SIZING" },
      after: {
        status: "SIZING_LOCKED",
        generationId,
        sizeBlockId: block.id,
      },
    });

    revalidateSizing(designId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Apply failed",
    };
  }
}

export async function pollSizingOverlay(
  designId: string,
  blockId: string,
): Promise<
  ActionResult<{
    overlayLines: OverlayGuideLine[];
    blockId: string;
  }>
> {
  try {
    await requirePermission("designs.create");
    const block = await getSizeBlock(blockId, { designId });
    if (!block) return { ok: false, error: "Block not found" };

    const heroGen = await resolveLockedHeroGeneration(designId);
    if (!heroGen) return { ok: false, error: "Locked hero not found" };

    const outputMeta = heroGen.outputMeta;
    const archetypeId = heroGen.archetypeId;
    if (!archetypeId) return { ok: false, error: "Archetype missing" };

    const [archetype] = await db
      .select({ heightInches: houseModels.heightInches })
      .from(houseModels)
      .where(eq(houseModels.id, archetypeId))
      .limit(1);
    if (!archetype) return { ok: false, error: "Archetype not found" };

    const grid = resolveChart(
      { sizeLabels: block.sizeLabels, baseSizeLabel: block.baseSizeLabel },
      block.rows.map((r) => ({
        measurementKey: r.measurementKey,
        baseValue: r.baseValue,
        gradeIncrement: r.gradeIncrement,
        gradeOverrides: r.gradeOverrides,
      })),
      block.pinnedCells.map((p) => ({
        measurementKey: p.measurementKey,
        sizeLabel: p.sizeLabel,
        value: p.value,
      })),
    );

    const valuesByKey: Record<string, number> = {};
    for (const row of block.rows) {
      valuesByKey[row.measurementKey] =
        grid[row.measurementKey]?.[block.baseSizeLabel]?.value ?? row.baseValue;
    }

    const { categoryKey, components } = await resolveDesignBlockId(designId);
    const anchorYBpByKey = await resolveAnchorYBpByKey({
      archetypeId,
      categoryKeys: [categoryKey, ...components],
      measurementKeys: block.rows.map((r) => r.measurementKey),
    });

    const imageHeightPx = outputMeta?.imageHeightPx ?? 1024;
    const modelPixelHeight =
      outputMeta?.modelPixelHeight ??
      Math.round((imageHeightPx * 8800) / 10_000);

    const overlayLines = computeOverlayLines({
      imageHeightPx,
      modelPixelHeight,
      archetypeHeightInches: archetype.heightInches,
      anchorYBpByKey,
      valuesByKey,
      formatValue: (v) => formatMeasure(v, "in"),
    });

    return { ok: true, data: { overlayLines, blockId: block.id } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Overlay refresh failed",
    };
  }
}
