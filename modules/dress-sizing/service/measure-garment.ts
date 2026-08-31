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
import { STANDARD_SIZES } from "../db/enums";
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

/** Per-POM record of what the photo said, what the template said, and why. */
export type PomMeasurementDetail = {
  pomKey: string;
  /** What the photo measured, hundredths of an inch (null = not measurable). */
  measured: number | null;
  /** The template's value before the photo. */
  prior: number;
  /** Result of fusing the two. */
  fused: number;
  /** Shift actually written to the chart (0 = none). */
  delta: number;
  /** Photo and template disagreed beyond 3σ — the template was kept. */
  flagged: boolean;
};

export type PhotoMeasurementSummary = {
  landmarks: GarmentLandmarks;
  /** Full per-POM trace — the answer to "why didn't the chest change?". */
  detail: PomMeasurementDetail[];
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

type ChartRow = {
  size: (typeof dressGeneratedChart.$inferSelect)["size"];
  pomKey: (typeof dressGeneratedChart.$inferSelect)["pomKey"];
  valueHundredths: number;
};

/**
 * Rebuild each POM's run from a snapped base and a single snapped step, so the
 * chart is simultaneously on the quarter-inch grid and evenly graded. Rows that
 * do not grade (every size equal, e.g. a sleeveless zero) stay flat.
 */
function regulariseRun(
  rows: ChartRow[],
  baseSize: ChartRow["size"],
): ChartRow[] {
  const sizes: readonly string[] = STANDARD_SIZES;
  const baseIdx = sizes.indexOf(baseSize);
  if (baseIdx < 0) return rows.map((r) => ({ ...r, valueHundredths: snapQuarter(r.valueHundredths) }));

  type Size = ChartRow["size"];
  type Pom = ChartRow["pomKey"];
  const byPom = new Map<Pom, Map<Size, number>>();
  for (const r of rows) {
    const bucket = byPom.get(r.pomKey) ?? new Map<Size, number>();
    bucket.set(r.size, r.valueHundredths);
    byPom.set(r.pomKey, bucket);
  }

  const out: ChartRow[] = [];
  for (const [pomKey, bySize] of byPom) {
    const present = (sizes as readonly Size[]).filter((s) => bySize.has(s));
    const base = snapQuarter(bySize.get(baseSize) ?? bySize.get(present[0]!) ?? 0);
    const first = bySize.get(present[0]!)!;
    const last = bySize.get(present[present.length - 1]!)!;
    const spans = present.length - 1;
    const step = spans > 0 ? snapQuarter((last - first) / spans) : 0;

    for (const size of present) {
      const value = base + step * (sizes.indexOf(size) - baseIdx);
      out.push({ size, pomKey, valueHundredths: Math.max(0, value) });
    }
  }
  return out;
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
  const detail: PomMeasurementDetail[] = [];
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
    const base = priorBase.get(key);
    if (base == null) continue;
    const measuredValue = result.measured[key]?.value ?? null;
    const flagged = result.conflicts.includes(key);
    // Snap the measured base onto the chart grid so every size stays on it.
    const delta =
      measuredValue == null || flagged ? 0 : snapQuarter(fused.value) - base;

    detail.push({
      pomKey: key,
      measured: measuredValue,
      prior: base,
      fused: fused.value,
      delta,
      flagged,
    });

    if (delta === 0) continue;
    for (const row of corrected) {
      if (row.pomKey === key) row.valueHundredths += delta;
    }
    applied.push({ pomKey: key, deltaHundredths: delta });
  }

  if (applied.length > 0) {
    // Reconcile first (a column must share one circumference), then regularise:
    // snapping each cell on its own puts values on the grid but destroys the
    // grade, because a fractional template increment rounds alternately up and
    // down (neck came out 2.00 2.00 2.25 2.50 2.50 2.75 — steps 0,¼,¼,0,¼).
    // Snapping the BASE and the STEP, then rebuilding the run, gives a chart
    // that is both on-grid and evenly graded.
    const reconciled = regulariseRun(
      reconcileSilhouette(corrected, input.reconcile),
      style.baseSize,
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
    detail,
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
