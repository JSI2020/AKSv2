"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/packages/db/client";
import {
  designs,
  dressGeneratedChart,
  sizeBlockRows,
  sizeBlockCells,
} from "@/packages/db/schema";
import {
  measureGarmentFromPhoto,
  type ChartCellRow,
  type PhotoMeasurementSummary,
} from "@/modules/dress-sizing/service/measure-garment";
import { DEFAULT_SIZE_BLOCK_SEEDS, uuidv7 } from "@aks/shared";
import { requireSizingEdit } from "@/modules/sizing/require-sizing-permission";
import { resolveStylePreset } from "./standard-styles";
import {
  pinSizeBlockCell,
  resolveEditableBlockId,
  updateDesignPieceBaseSizes,
} from "@/modules/sizing/fork-actions";
import { getSizeBlock } from "@/modules/sizing/block-actions";
import { buildStyleChart } from "@/modules/dress-sizing/recognition/review";
import { POM_TO_MEASUREMENT } from "@/modules/sizing/garment-size-guide/measurement-pom-map";

/**
 * Values are integer hundredths of an inch; snap to the quarter-inch grid.
 * A true 0 stays 0 — a sleeveless sleeve or absent feature must not be
 * inflated to a phantom quarter inch.
 */
function snapQuarter(v: number): number {
  return Math.max(0, Math.round(v / 25) * 25);
}

/** Chart size order used by the dress-sizing generator. */
const CHART_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"] as const;

/**
 * If the generated per-size values grade uniformly (identical step between
 * every adjacent size), return that step so the row can carry a clean
 * gradeIncrement instead of six independently-snapped pins. Snapping each size
 * separately manufactures irregular steps (0, +¼, +¼, 0, +¼ …) that read as
 * engine errors in the chart.
 */
function uniformStep(vals: Record<string, number>): number | null {
  const ordered = CHART_SIZE_ORDER.filter((s) => vals[s] != null).map(
    (s) => vals[s]!,
  );
  if (ordered.length < 3) return null;
  const first = ordered[1]! - ordered[0]!;
  for (let i = 2; i < ordered.length; i++) {
    if (ordered[i]! - ordered[i - 1]! !== first) return null;
  }
  return first;
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

  // Keep RAW values here; snap once at write time. Snapping per size first and
  // grading later is what produced irregular steps in the visible chart.
  const byMeasure = new Map<string, Record<string, number>>();
  for (const r of chartRows) {
    const mk = POM_TO_MEASUREMENT[r.pomKey];
    if (!mk) continue;
    const bucket = byMeasure.get(mk) ?? {};
    bucket[r.size] = r.valueHundredths;
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
    if (baseVal != null) bases[mk] = snapQuarter(baseVal);
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

    // Prefer a clean uniform grade over six independent pins: derive the step
    // from the RAW generated values, snap it once. An absent feature
    // (base 0, e.g. sleeveless) grades flat at 0 instead of inheriting the
    // seeded row's default increment — that inheritance is what produced
    // negative sleeve lengths in smaller sizes.
    const step = uniformStep(vals);
    const base = bases[mk];
    if (step != null || base === 0) {
      const increment =
        base === 0 ? 0 : Math.max(0, Math.round((step ?? 0) / 25) * 25);
      await db
        .update(sizeBlockRows)
        .set({ gradeIncrement: increment, gradeOverrides: {} })
        .where(
          and(
            eq(sizeBlockRows.blockId, finalBlockId),
            eq(sizeBlockRows.measurementKey, mk),
          ),
        );
      continue;
    }

    for (const [size, value] of Object.entries(vals)) {
      if (size === baseLabel) continue;
      await pinSizeBlockCell({
        blockId: finalBlockId,
        measurementKey: mk,
        sizeLabel: size,
        value: snapQuarter(value),
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
      /** Present when the photo could be measured; null = template-only. */
      measurement: PhotoMeasurementSummary | null;
      /** House standard for the detected garment type, before corrections. */
      standardChart: ChartCellRow[];
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

    // One shared engine does photo → measured chart → ghost.
    const sizing = await measureGarmentFromPhoto({
      image,
      categoryKey: pieceKey,
    });
    const measurement = sizing.measurement;

    const fill = await fillBlockFromStyle(designId, pieceKey, blockId, sizing.styleId);
    if (!fill.ok) return { ok: false, error: fill.error };

    const ghostUrl = sizing.ghostUrl;

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
      confidence: sizing.confidence,
      template: sizing.templateKey,
      lowConfidence: sizing.lowConfidence,
      ghostUrl,
      measurement,
      standardChart: sizing.standardChart,
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
    const preset = resolveStylePreset(styleId, pieceKey);
    if (!preset) return { ok: false, error: "Choose a standard style." };

    await requireSizingEdit(designId);

    // Straight from the house standard table for the chosen style's category —
    // no recognition, no engine composition. The selector value is qualified
    // "CATEGORY:id", so picking an abaya style on a kameez piece applies the
    // abaya standard.
    const category = (
      styleId.includes(":") ? (styleId.split(":")[0] ?? pieceKey) : pieceKey
    ).toUpperCase();
    const seed =
      DEFAULT_SIZE_BLOCK_SEEDS.find((x) => x.categoryKey === category) ??
      DEFAULT_SIZE_BLOCK_SEEDS.find(
        (x) => x.categoryKey === pieceKey.toUpperCase(),
      );
    if (!seed || seed.rows.length === 0) {
      return {
        ok: false,
        error: `No standard chart exists for ${category}.`,
      };
    }

    // Edit the design's own copy, never the shared house block.
    const resolved = await resolveEditableBlockId(blockId, designId);
    const editBlockId = resolved.blockId;

    await db.transaction(async (tx) => {
      // Replace the chart wholesale: a standard is a complete chart, and
      // leftover rows from a previous style would silently survive.
      await tx.delete(sizeBlockCells).where(eq(sizeBlockCells.blockId, editBlockId));
      await tx.delete(sizeBlockRows).where(eq(sizeBlockRows.blockId, editBlockId));
      await tx.insert(sizeBlockRows).values(
        seed.rows.map((row) => ({
          id: uuidv7(),
          blockId: editBlockId,
          measurementKey: row.measurementKey,
          baseValue: row.baseValue,
          gradeIncrement: row.gradeIncrement,
          gradeOverrides: row.gradeOverrides ?? {},
          sortOrder: row.sortOrder,
        })),
      );
    });

    revalidatePath(`/admin/designs/${designId}`);

    return {
      ok: true,
      blockId: editBlockId,
      filled: seed.rows.map((r) => r.measurementKey),
      label: preset.label,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not apply style.",
    };
  }
}

