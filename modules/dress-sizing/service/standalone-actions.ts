"use server";

import { asc, eq } from "drizzle-orm";

import { db } from "@/packages/db/client";
import { dressGeneratedChart } from "@/packages/db/schema";
import { requirePermission } from "@/modules/auth";

import { STANDARD_SIZES, type PomKey } from "../db/enums";
import { POM_LABELS } from "../ui/labels";
import { measureGarmentFromPhoto } from "./measure-garment";

export type StandaloneChartRow = {
  pomKey: string;
  label: string;
  /** size label → hundredths of an inch */
  valuesBySize: Record<string, number>;
};

export type StandaloneSizingResult =
  | {
      ok: true;
      styleId: string;
      template: string;
      confidence: number;
      lowConfidence: boolean;
      sizeLabels: string[];
      rows: StandaloneChartRow[];
      ghostUrl: string | null;
      /** How the photo was measured, or null when it fell back to the template. */
      measured: {
        captureContext: string;
        anchor: string;
        corrected: number;
        flagged: number;
        landmarkConfidence: number;
        warnings: string[];
      } | null;
    }
  | { ok: false; error: string };

/**
 * Measure any garment photo without binding it to a design — the engine's
 * design-independence made usable. Produces the XS–XXL chart and the ghost
 * mannequin for inspection; nothing is written to a design.
 */
export async function measureGarmentStandalone(
  fd: FormData,
): Promise<StandaloneSizingResult> {
  try {
    await requirePermission("designs.create");

    const image = fd.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return { ok: false, error: "Choose a garment photo to measure." };
    }

    const sizing = await measureGarmentFromPhoto({ image });

    const chart = await db
      .select()
      .from(dressGeneratedChart)
      .where(eq(dressGeneratedChart.styleId, sizing.styleId))
      .orderBy(asc(dressGeneratedChart.pomKey));

    const byPom = new Map<string, Record<string, number>>();
    for (const row of chart) {
      const bucket = byPom.get(row.pomKey) ?? {};
      bucket[row.size] = row.valueHundredths;
      byPom.set(row.pomKey, bucket);
    }

    const rows: StandaloneChartRow[] = [...byPom.entries()].map(
      ([pomKey, valuesBySize]) => ({
        pomKey,
        label: POM_LABELS[pomKey as PomKey] ?? pomKey,
        valuesBySize,
      }),
    );

    const m = sizing.measurement;
    return {
      ok: true,
      styleId: sizing.styleId,
      template: sizing.templateKey,
      confidence: sizing.confidence,
      lowConfidence: sizing.lowConfidence,
      sizeLabels: [...STANDARD_SIZES],
      rows,
      ghostUrl: sizing.ghostUrl,
      measured: m
        ? {
            captureContext: m.landmarks.captureContext,
            anchor: m.anchor,
            corrected: m.applied.length,
            flagged: m.conflicts.length,
            landmarkConfidence: m.landmarkConfidence,
            warnings: m.warnings,
          }
        : null,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Measurement failed.",
    };
  }
}
