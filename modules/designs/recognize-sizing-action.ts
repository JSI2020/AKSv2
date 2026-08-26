"use server";

import { eq } from "drizzle-orm";

import { db } from "@/packages/db/client";
import {
  designs,
  dressGeneratedChart,
  sizeBlockRows,
} from "@/packages/db/schema";
import { DEFAULT_SIZE_BLOCK_SEEDS, uuidv7 } from "@aks/shared";
import { requireSizingEdit } from "@/modules/sizing/require-sizing-permission";
import { findStylePreset } from "./standard-styles";
import {
  pinSizeBlockCell,
  resolveEditableBlockId,
  updateDesignPieceBaseSizes,
} from "@/modules/sizing/fork-actions";
import { getSizeBlock } from "@/modules/sizing/block-actions";
import { createRecognitionAdapter } from "@/modules/dress-sizing/recognition/pipeline";
import { recognizeGarment } from "@/modules/dress-sizing/recognition/recognize";
import { buildStyleChart } from "@/modules/dress-sizing/recognition/review";
import { uploadVisionFile, renderFalEdit } from "@/modules/dress-sizing/providers/fal";
import { ghostMannequinPrompt } from "@/modules/dress-sizing/core/ghost-prompt";

/** Dress-sizing POM keys → the house size-block measurement keys. */
const POM_TO_MEASUREMENT: Record<string, string> = {
  chest: "BUST",
  waist: "WAIST",
  hip: "HIP",
  shoulder: "SHOULDER",
  sleeveLength: "SLEEVE_LENGTH",
  garmentLength: "LENGTH",
  hemWidth: "SWEEP",
  neckDrop: "NECK_DEPTH_FRONT",
};

/** Values are integer hundredths of an inch; snap to the quarter-inch grid. */
function snapQuarter(v: number): number {
  return Math.max(25, Math.round(v / 25) * 25);
}

type FillResult =
  | { ok: true; blockId: string; filled: string[] }
  | { ok: false; error: string };

/**
 * Read a generated dress-sizing chart, map its POMs onto the house
 * measurement keys, and write it into this design's own size table. The block
 * is forked for the design; if the piece's chart has no measurement rows yet,
 * the category's standard rows are seeded first so there is a chart to fill.
 * Only measurement keys that belong to the piece's category are filled (so a
 * trouser gets waist/hip/length, never chest/shoulder). The storefront size
 * guide reads that same table.
 */
async function fillBlockFromStyle(
  designId: string,
  pieceKey: string,
  blockId: string,
  styleId: string,
): Promise<FillResult> {
  const chartRows = await db
    .select()
    .from(dressGeneratedChart)
    .where(eq(dressGeneratedChart.styleId, styleId));

  const byMeasure = new Map<string, Record<string, number>>();
  for (const r of chartRows) {
    const mk = POM_TO_MEASUREMENT[r.pomKey];
    if (!mk) continue;
    const bucket = byMeasure.get(mk) ?? {};
    bucket[r.size] = snapQuarter(r.valueHundredths);
    byMeasure.set(mk, bucket);
  }
  if (byMeasure.size === 0) {
    return { ok: false, error: "No measurements were generated." };
  }

  // Fork the house chart for this design.
  const resolved = await resolveEditableBlockId(blockId, designId);
  const editBlockId = resolved.blockId;

  // Ensure the piece's chart has its category's measurement rows. Empty house
  // charts get seeded from the canonical per-category defaults.
  const seed = DEFAULT_SIZE_BLOCK_SEEDS.find(
    (s) => s.categoryKey === pieceKey.toUpperCase(),
  );
  const existing = await db
    .select({ measurementKey: sizeBlockRows.measurementKey })
    .from(sizeBlockRows)
    .where(eq(sizeBlockRows.blockId, editBlockId));
  const existingKeys = new Set(existing.map((r) => r.measurementKey));

  if (seed) {
    for (const row of seed.rows) {
      if (existingKeys.has(row.measurementKey)) continue;
      await db.insert(sizeBlockRows).values({
        id: uuidv7(),
        blockId: editBlockId,
        measurementKey: row.measurementKey,
        baseValue: row.baseValue,
        gradeIncrement: row.gradeIncrement,
        gradeOverrides: row.gradeOverrides ?? {},
        sortOrder: row.sortOrder,
      });
      existingKeys.add(row.measurementKey);
    }
  }
  if (existingKeys.size === 0) {
    return { ok: false, error: "This piece has no size chart to fill." };
  }

  // Only fill measurement keys that belong to this piece's chart.
  const blockDetail = await getSizeBlock(editBlockId, { designId });
  const baseLabel = blockDetail?.baseSizeLabel ?? "M";

  const bases: Record<string, number> = {};
  for (const [mk, vals] of byMeasure) {
    if (!existingKeys.has(mk)) continue;
    const baseVal = vals[baseLabel];
    if (baseVal != null) bases[mk] = baseVal;
  }
  if (Object.keys(bases).length === 0) {
    return { ok: false, error: "No measurement matches this piece's chart." };
  }

  // Set the base (M) values (clears pins), then pin every other size.
  const baseResult = await updateDesignPieceBaseSizes({
    blockId: editBlockId,
    designId,
    bases,
  });
  if (!baseResult.ok || !baseResult.blockId) {
    return {
      ok: false,
      error: baseResult.ok ? "Could not save base sizes." : baseResult.error,
    };
  }
  const finalBlockId = baseResult.blockId;

  const filled: string[] = [];
  for (const [mk, vals] of byMeasure) {
    if (!existingKeys.has(mk)) continue;
    filled.push(mk);
    for (const [size, value] of Object.entries(vals)) {
      if (size === baseLabel) continue;
      await pinSizeBlockCell({
        blockId: finalBlockId,
        measurementKey: mk,
        sizeLabel: size,
        value,
        designId,
      });
    }
  }

  return { ok: true, blockId: finalBlockId, filled };
}

export type RecognizeSizingResult =
  | {
      ok: true;
      blockId: string;
      filled: string[];
      confidence: number;
      template: string;
      lowConfidence: boolean;
      ghostUrl: string | null;
    }
  | { ok: false; error: string };

/**
 * Upload a garment photo → recognise its style with AI → generate an XS–XXL
 * measurement chart → write it into this design's own size table, plus a
 * best-effort ghost-mannequin preview.
 */
export async function recognizeDesignSizing(
  fd: FormData,
): Promise<RecognizeSizingResult> {
  try {
    const designId = String(fd.get("designId") ?? "");
    const blockId = String(fd.get("blockId") ?? "");
    const pieceKey = String(fd.get("pieceKey") ?? "");
    const image = fd.get("image");

    if (!designId || !blockId) {
      return { ok: false, error: "Missing design or size chart." };
    }
    if (!(image instanceof File) || image.size === 0) {
      return { ok: false, error: "Choose a garment photo to recognise." };
    }

    await requireSizingEdit(designId);

    const imageUrl = await uploadVisionFile(image);
    const proposal = await recognizeGarment(
      db,
      imageUrl,
      createRecognitionAdapter(),
    );

    const { styleId } = await buildStyleChart(db, {
      templateKey: proposal.templateKey,
      lengthBand: proposal.lengthBand,
      fitIntent: proposal.fitIntent,
      imageUrl,
      confidence: proposal.confidence,
      status: "draft",
      points: proposal.points,
    });

    const fill = await fillBlockFromStyle(designId, pieceKey, blockId, styleId);
    if (!fill.ok) return { ok: false, error: fill.error };

    // Best-effort ghost-mannequin visual (never fails the size fill).
    let ghostUrl: string | null = null;
    try {
      ghostUrl = await renderFalEdit(
        image,
        ghostMannequinPrompt({
          garmentType: proposal.templateKey,
          lengthBand: proposal.lengthBand,
          points: proposal.points,
        }),
      );
    } catch {
      ghostUrl = null;
    }

    // Persist the ghost image with the design so the storefront can show it.
    if (ghostUrl) {
      await db
        .update(designs)
        .set({ sizingGhostUrl: ghostUrl, updatedAt: new Date() })
        .where(eq(designs.id, designId));
    }

    return {
      ok: true,
      blockId: fill.blockId,
      filled: fill.filled,
      confidence: proposal.confidence,
      template: proposal.templateKey,
      lowConfidence: proposal.lowConfidence,
      ghostUrl,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Recognition failed.",
    };
  }
}

export type ApplyStandardResult =
  | { ok: true; blockId: string; filled: string[]; label: string }
  | { ok: false; error: string };

/**
 * Fill this design's size table from a standard style preset (no photo, no AI)
 * — the seeded dress-sizing template supplies the standard measurements.
 */
export async function applyStandardStyle(
  fd: FormData,
): Promise<ApplyStandardResult> {
  try {
    const designId = String(fd.get("designId") ?? "");
    const blockId = String(fd.get("blockId") ?? "");
    const pieceKey = String(fd.get("pieceKey") ?? "");
    const styleId = String(fd.get("styleId") ?? "");

    if (!designId || !blockId) {
      return { ok: false, error: "Missing design or size chart." };
    }
    const preset = findStylePreset(pieceKey, styleId);
    if (!preset) return { ok: false, error: "Choose a standard style." };

    await requireSizingEdit(designId);

    const { styleId: generatedStyleId } = await buildStyleChart(db, {
      templateKey: preset.key,
      lengthBand: preset.lengthBand,
      fitIntent: preset.fitIntent,
      name: `standard ${preset.id}`,
      status: "draft",
    });

    const fill = await fillBlockFromStyle(
      designId,
      pieceKey,
      blockId,
      generatedStyleId,
    );
    if (!fill.ok) return { ok: false, error: fill.error };

    return {
      ok: true,
      blockId: fill.blockId,
      filled: fill.filled,
      label: preset.label,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not apply style.",
    };
  }
}
