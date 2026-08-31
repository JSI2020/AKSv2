"use server";

import { eq } from "drizzle-orm";

import { db } from "@/packages/db/client";
import { designs } from "@/packages/db/schema";
import { requireSizingEdit } from "@/modules/sizing/require-sizing-permission";

export type OverlayPlacementInput = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type SaveOverlayResult =
  | { ok: true }
  | { ok: false; error: string };

const isFraction = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= -0.5 && n <= 1.5;

/**
 * Persist where the measurement lines sit on this design's ghost.
 *
 * Position only — a placement never changes what a line measures, so this
 * cannot alter the size chart. Coordinates are normalized against the ghost
 * image and stored a little outside 0–1 to allow a label pulled just past the
 * edge, but anything wilder is rejected as a bad drag.
 */
export async function saveSizingOverlay(
  designId: string,
  placements: Record<string, OverlayPlacementInput>,
): Promise<SaveOverlayResult> {
  try {
    if (!designId) return { ok: false, error: "Missing design." };
    await requireSizingEdit(designId);

    const clean: Record<string, OverlayPlacementInput> = {};
    for (const [pomKey, p] of Object.entries(placements ?? {})) {
      if (!p || typeof pomKey !== "string") continue;
      if (
        !isFraction(p.x1) ||
        !isFraction(p.y1) ||
        !isFraction(p.x2) ||
        !isFraction(p.y2)
      ) {
        continue;
      }
      clean[pomKey] = { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 };
    }

    await db
      .update(designs)
      .set({
        sizingOverlay: Object.keys(clean).length > 0 ? clean : null,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, designId));

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save line positions.",
    };
  }
}

/** Drop every hand placement so the lines return to their computed positions. */
export async function resetSizingOverlay(
  designId: string,
): Promise<SaveOverlayResult> {
  return saveSizingOverlay(designId, {});
}
