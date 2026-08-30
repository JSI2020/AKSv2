/**
 * Garment sizing engine — the single reusable service behind every
 * "build a size chart from a photo" surface (Designs → Sizing tab, AI Studio →
 * Sizing, and anything added later).
 *
 * It owns the whole photo→chart pipeline and nothing about where the result is
 * stored, so callers stay thin: they decide what to bind the chart to, this
 * decides what the garment measures.
 *
 *   upload → classify style → compose template chart
 *          → detect landmarks → measure → fuse → correct the chart
 *          → ghost mannequin (best effort)
 *
 * Deliberately a plain module, not a "use server" file, so it can export types
 * and be called from any server action.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/packages/db/client";
import { dressGeneratedChart, dressStyle } from "@/packages/db/schema";
import {
  estimateFromPhoto,
  ghostProportions,
  imageSizeFromFile,
  templatePrior,
  type Estimate,
  type GarmentLandmarks,
  type PhotoPomKey,
} from "@/modules/garment-metrology";

import { ghostMannequinPrompt } from "../core/ghost-prompt";
import {
  reconcileSilhouette,
  resolveSilhouette,
  type SilhouetteMode,
} from "../core/silhouette";
import type { FitIntent, GarmentType, LengthBand } from "../db/enums";
import type { HemFullness, StylePoints } from "../core/style-points";
import { renderFalEdit, uploadVisionFile } from "../providers/fal";
import { detectLandmarks } from "../recognition/landmark-detect";
import type { VisionAdapter } from "../recognition/adapter";
import { createRecognitionAdapter } from "../recognition/pipeline";
import { recognizeGarment } from "../recognition/recognize";
import { buildStyleChart } from "../recognition/review";

type SilhouetteReconcile = {
  silhouette: SilhouetteMode;
  hemFullness: HemFullness;
  templateKey: GarmentType;
};

/** POM keys the photo pass can measure. */
const MEASURABLE_POMS: Record<PhotoPomKey, true> = {
  chest: true,
  waist: true,
  shoulder: true,
  garmentLength: true,
  sleeveLength: true,
  hemWidth: true,
  neckDrop: true,
};

export type PhotoMeasurementSummary = {
  landmarks: GarmentLandmarks;
  /** POM keys the photo actually moved, with the shift applied (hundredths). */
  applied: Array<{ pomKey: string; deltaHundredths: number }>;
  /** POM keys where photo and template disagreed beyond 3σ — template kept. */
  conflicts: string[];
  anchor: string;
  landmarkConfidence: number;
  warnings: string[];
  imageWidthPx: number;
  imageHeightPx: number;
};

/**
 * Measure the photo and correct the composed template chart with it.
 *
 * The photo fixes what the sample garment ACTUALLY measures; the house grade
 * rules still produce every other size. So a fused value is applied as a
 * uniform shift across all sizes of that POM — the run keeps its grading (and
 * therefore a clean gradeIncrement downstream) while landing on the real
 * garment. Fail-soft: any missing piece leaves the template untouched.
 */
/** Charts live on the quarter-inch grid; a fused value must land on it too. */
function snapQuarter(hundredths: number): number {
  return Math.round(hundredths / 25) * 25;
}

async function applyPhotoMeasurements(input: {
  styleId: string;
  image: File;
  imageUrl: string;
  adapter: Parameters<typeof detectLandmarks>[1];
  reconcile: SilhouetteReconcile;
}): Promise<PhotoMeasurementSummary | null> {
  const size = await imageSizeFromFile(input.image);
  if (!size) return null;

  const detection = await detectLandmarks(input.imageUrl, input.adapter);
  if (!detection) return null;

  const [style] = await db
    .select({ baseSize: dressStyle.baseSize })
    .from(dressStyle)
    .where(eq(dressStyle.id, input.styleId))
    .limit(1);
  if (!style) return null;

  const chartRows = await db
    .select()
    .from(dressGeneratedChart)
    .where(eq(dressGeneratedChart.styleId, input.styleId));
  if (chartRows.length === 0) return null;

  const priorBase = new Map<string, number>();
  for (const row of chartRows) {
    if (row.size === style.baseSize) {
      priorBase.set(row.pomKey, row.valueHundredths);
    }
  }

  const prior: Partial<Record<PhotoPomKey, Estimate>> = {};
  for (const [pomKey, value] of priorBase) {
    const key = pomKey as PhotoPomKey;
    if (key in MEASURABLE_POMS) prior[key] = templatePrior(key, value);
  }

  let result;
  try {
    result = estimateFromPhoto({
      landmarks: detection.landmarks,
      imageWidthPx: size.width,
      imageHeightPx: size.height,
      prior,
    });
  } catch {
    return null;
  }

  const applied: PhotoMeasurementSummary["applied"] = [];
  // Work in memory first, then reconcile, then persist — a per-POM shift alone
  // would break the silhouette invariant (a column's chest/waist/hip must stay
  // one circumference even after the photo moves one of them).
  const corrected = chartRows.map((r) => ({
    size: r.size,
    pomKey: r.pomKey,
    valueHundredths: r.valueHundredths,
  }));

  for (const [pomKey, fused] of Object.entries(result.fused)) {
    const key = pomKey as PhotoPomKey;
    if (!result.measured[key]) continue; // template-only row, nothing to correct
    if (result.conflicts.includes(key)) continue;
    const base = priorBase.get(key);
    if (base == null) continue;
    // Snap the measured base onto the chart grid so every size stays on it.
    const delta = snapQuarter(fused.value) - base;
    if (delta === 0) continue;

    for (const row of corrected) {
      if (row.pomKey === key) row.valueHundredths += delta;
    }
    applied.push({ pomKey: key, deltaHundredths: delta });
  }

  if (applied.length > 0) {
    // Reconcile first (a column must share one circumference), then snap every
    // cell: shifting the base alone leaves the other sizes carrying the
    // template's fractional grade increments, which is how 2.49" reaches a
    // chart. Snapping after reconcile keeps the equalities intact.
    const reconciled = reconcileSilhouette(corrected, input.reconcile).map(
      (row) => ({ ...row, valueHundredths: snapQuarter(row.valueHundredths) }),
    );
    for (const row of reconciled) {
      const before = chartRows.find(
        (r) => r.pomKey === row.pomKey && r.size === row.size,
      );
      if (!before || before.valueHundredths === row.valueHundredths) continue;
      await db
        .update(dressGeneratedChart)
        .set({ valueHundredths: row.valueHundredths })
        .where(
          and(
            eq(dressGeneratedChart.styleId, input.styleId),
            eq(dressGeneratedChart.pomKey, row.pomKey),
            eq(dressGeneratedChart.size, row.size),
          ),
        );
    }
  }

  return {
    landmarks: detection.landmarks,
    applied,
    conflicts: result.conflicts,
    anchor: result.anchor.kind,
    landmarkConfidence: detection.confidence,
    warnings: detection.warnings,
    imageWidthPx: size.width,
    imageHeightPx: size.height,
  };
}

export type MeasureGarmentInput = {
  image: File;
  /** Reuse an already-hosted URL instead of re-uploading. */
  imageUrl?: string;
  /** Render the ghost mannequin (one extra generation call). Default true. */
  ghost?: boolean;
  /**
   * Vision adapter override. Defaults to the configured provider chain; supply
   * one to drive the pipeline deterministically (tests, replay, batch jobs).
   */
  adapter?: VisionAdapter;
};

export type MeasureGarmentResult = {
  imageUrl: string;
  /** Generated dress-sizing style holding the corrected XS–XXL chart. */
  styleId: string;
  templateKey: GarmentType;
  lengthBand: LengthBand;
  fitIntent: FitIntent;
  points?: StylePoints;
  confidence: number;
  lowConfidence: boolean;
  measurement: PhotoMeasurementSummary | null;
  ghostUrl: string | null;
};

/**
 * Photo → measured, graded size chart. The returned `styleId` owns the chart
 * rows; callers bind them wherever they need (a design's size block, a preview
 * table, an export).
 */
export async function measureGarmentFromPhoto(
  input: MeasureGarmentInput,
): Promise<MeasureGarmentResult> {
  const imageUrl = input.imageUrl ?? (await uploadVisionFile(input.image));
  const adapter = input.adapter ?? createRecognitionAdapter();
  const proposal = await recognizeGarment(db, imageUrl, adapter);

  const { styleId } = await buildStyleChart(db, {
    templateKey: proposal.templateKey,
    lengthBand: proposal.lengthBand,
    fitIntent: proposal.fitIntent,
    imageUrl,
    confidence: proposal.confidence,
    status: "draft",
    points: proposal.points,
  });

  let measurement: PhotoMeasurementSummary | null = null;
  try {
    measurement = await applyPhotoMeasurements({
      styleId,
      image: input.image,
      imageUrl,
      adapter,
      reconcile: {
        templateKey: proposal.templateKey,
        hemFullness: proposal.points?.hem?.fullness ?? "regular",
        silhouette: resolveSilhouette({
          templateKey: proposal.templateKey,
          fitIntent: proposal.fitIntent,
          points: proposal.points,
        }),
      },
    });
  } catch {
    measurement = null;
  }

  let ghostUrl: string | null = null;
  if (input.ghost !== false) {
    try {
      ghostUrl = await renderFalEdit(
        input.image,
        ghostMannequinPrompt({
          garmentType: proposal.templateKey,
          lengthBand: proposal.lengthBand,
          points: proposal.points,
          proportions: measurement
            ? ghostProportions(
                measurement.landmarks,
                measurement.imageWidthPx,
                measurement.imageHeightPx,
              )
            : undefined,
        }),
      );
    } catch {
      ghostUrl = null;
    }
  }

  return {
    imageUrl,
    styleId,
    templateKey: proposal.templateKey,
    lengthBand: proposal.lengthBand,
    fitIntent: proposal.fitIntent,
    points: proposal.points,
    confidence: proposal.confidence,
    lowConfidence: proposal.lowConfidence,
    measurement,
    ghostUrl,
  };
}
