import { z } from "zod";

import {
  validateLandmarks,
  type GarmentLandmarks,
} from "@/modules/garment-metrology";

import type { VisionAdapter } from "./adapter";

/**
 * Second recognition pass: measurable landmarks.
 *
 * Deliberately separate from style classification — this pass is additive and
 * fail-soft. If the model returns nothing usable, sizing falls back to exactly
 * today's template-only behaviour; a bad detection never becomes a
 * measurement. Coordinates are requested as integer percentages because vision
 * models place those far more reliably than decimals.
 */
export const LANDMARK_PROMPT = `You are measuring a garment photo. Return JSON only, no prose.

Report the image position of each visible point as integer PERCENTAGES of the image: x from 0 (left edge) to 100 (right edge), y from 0 (top edge) to 100 (bottom edge).

{"captureContext":"flat_lay|on_model|on_mannequin|hanging",
 "confidence":0-100,
 "shoulderL":[x,y],"shoulderR":[x,y],
 "pitL":[x,y],"pitR":[x,y],
 "waistL":[x,y],"waistR":[x,y],
 "hemL":[x,y],"hemR":[x,y],
 "neckTop":[x,y],"neckFront":[x,y],
 "cuffL":[x,y],"cuffR":[x,y],
 "personTop":[x,y],"personBottom":[x,y]}

Definitions — be precise, these become real measurements:
- captureContext: "flat_lay" if the garment lies flat on a surface; "on_model" if worn by a person; "on_mannequin" if on a dress form or ghost mannequin; "hanging" if on a hanger.
- shoulderL/shoulderR: the outer ends of the shoulder seam, left then right as seen in the image.
- pitL/pitR: the ARMHOLE SEAM where the sleeve joins the body, just under the armpit — the chest line. Critical: if the sleeves hang down alongside the body, do NOT use the outer edge of the sleeve. Follow the seam line inward to where the sleeve is stitched to the body and mark THAT point. The distance between pitL and pitR should be only slightly wider than the distance between shoulderL and shoulderR — never close to twice it.
- waistL/waistR: the garment's narrowest points between pit and hem. Omit if the garment is a straight column with no narrowing.
- hemL/hemR: the bottom corners of the garment's lower edge.
- neckTop: the highest point of the neckline at the centre back or shoulder line. neckFront: the lowest point of the front neckline.
- cuffL/cuffR: the sleeve openings. OMIT BOTH ENTIRELY if the garment is sleeveless.
- personTop/personBottom: only when a person or mannequin is visible — the top of the head and the point where the feet meet the floor. Omit for flat-lay.

Rules: omit any key you cannot see rather than guessing. Keep left/right as they appear in the image (left = smaller x). Do not report inches or centimetres.`;

const pt = z.tuple([z.number(), z.number()]);

const landmarkSchema = z.object({
  captureContext: z
    .enum(["flat_lay", "on_model", "on_mannequin", "hanging"])
    .default("on_model"),
  confidence: z.number().min(0).max(100).default(0),
  shoulderL: pt,
  shoulderR: pt,
  pitL: pt,
  pitR: pt,
  waistL: pt.optional(),
  waistR: pt.optional(),
  hemL: pt,
  hemR: pt,
  neckTop: pt.optional(),
  neckFront: pt.optional(),
  cuffL: pt.optional(),
  cuffR: pt.optional(),
  personTop: pt.optional(),
  personBottom: pt.optional(),
});

export type LandmarkDetection = {
  landmarks: GarmentLandmarks;
  confidence: number;
  warnings: string[];
};

function parseJson(text: string): unknown {
  const fenced = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const candidate = (fenced ?? text.trim()).replace(/^[^{]*/, "");
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/** Percent pair → normalized point. */
function norm(p: [number, number]) {
  return { x: p[0] / 100, y: p[1] / 100 };
}

function optional(p: [number, number] | undefined) {
  return p ? norm(p) : undefined;
}

/**
 * Detect landmarks for measurement. Returns null when the pass fails or the
 * geometry is not physically coherent — callers then use the template alone.
 */
export async function detectLandmarks(
  imageUrl: string,
  adapter: VisionAdapter,
): Promise<LandmarkDetection | null> {
  let raw: unknown;
  try {
    raw = parseJson(await adapter.complete(imageUrl, LANDMARK_PROMPT));
  } catch {
    return null;
  }
  const parsed = landmarkSchema.safeParse(raw);
  if (!parsed.success) return null;
  const d = parsed.data;

  const landmarks: GarmentLandmarks = {
    captureContext: d.captureContext,
    shoulderL: norm(d.shoulderL),
    shoulderR: norm(d.shoulderR),
    pitL: norm(d.pitL),
    pitR: norm(d.pitR),
    waistL: optional(d.waistL),
    waistR: optional(d.waistR),
    hemL: norm(d.hemL),
    hemR: norm(d.hemR),
    neckTop: optional(d.neckTop),
    neckFront: optional(d.neckFront),
    cuffL: optional(d.cuffL),
    cuffR: optional(d.cuffR),
    personTop: optional(d.personTop),
    personBottom: optional(d.personBottom),
  };

  const validation = validateLandmarks(landmarks);
  if (!validation.ok) return null;

  return {
    landmarks,
    confidence: d.confidence / 100,
    warnings: validation.warnings,
  };
}
