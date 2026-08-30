/**
 * Garment landmarks — the vision model's measurable output.
 *
 * All coordinates are NORMALIZED to the image (0–1, origin top-left), so the
 * contract is resolution-independent. A landmark set that fails validation is
 * discarded and the engine falls back to the style-template prior alone —
 * a bad detection must never masquerade as a measurement.
 */

import type { CaptureContext } from "./girth";

export type NormPoint = { x: number; y: number };

export type GarmentLandmarks = {
  captureContext: CaptureContext;
  /** Shoulder seam ends. */
  shoulderL: NormPoint;
  shoulderR: NormPoint;
  /** Underarm/pit points — the chest line. */
  pitL: NormPoint;
  pitR: NormPoint;
  /** Narrowest torso points — the waist line. */
  waistL?: NormPoint;
  waistR?: NormPoint;
  /** Hem corners at the bottom edge. */
  hemL: NormPoint;
  hemR: NormPoint;
  /** Centre-back neck top and the lowest front neckline point. */
  neckTop?: NormPoint;
  neckFront?: NormPoint;
  /** Sleeve end (cuff) — omit for sleeveless. */
  cuffL?: NormPoint;
  cuffR?: NormPoint;
  /** Full-body extent when a person/mannequin is visible head to floor. */
  personTop?: NormPoint;
  personBottom?: NormPoint;
};

export type LandmarkValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function inUnit(p: NormPoint | undefined): boolean {
  return !p || (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
}

/**
 * Geometry a real garment photo must satisfy: everything inside the frame,
 * pairs left-of-right, and the vertical story reads shoulder → pit → waist →
 * hem. Asymmetric pair heights beyond 5% of the frame flag perspective/pose
 * trouble (warning); broken ordering is disqualifying (error).
 */
export function validateLandmarks(lm: GarmentLandmarks): LandmarkValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const all: Array<[string, NormPoint | undefined]> = [
    ["shoulderL", lm.shoulderL], ["shoulderR", lm.shoulderR],
    ["pitL", lm.pitL], ["pitR", lm.pitR],
    ["waistL", lm.waistL], ["waistR", lm.waistR],
    ["hemL", lm.hemL], ["hemR", lm.hemR],
    ["neckTop", lm.neckTop], ["neckFront", lm.neckFront],
    ["cuffL", lm.cuffL], ["cuffR", lm.cuffR],
    ["personTop", lm.personTop], ["personBottom", lm.personBottom],
  ];
  for (const [name, p] of all) {
    if (!inUnit(p)) errors.push(`${name} outside the image frame`);
  }

  const pairs: Array<[string, NormPoint | undefined, NormPoint | undefined]> = [
    ["shoulder", lm.shoulderL, lm.shoulderR],
    ["pit", lm.pitL, lm.pitR],
    ["waist", lm.waistL, lm.waistR],
    ["hem", lm.hemL, lm.hemR],
  ];
  for (const [name, l, r] of pairs) {
    if (!l || !r) continue;
    if (l.x >= r.x) errors.push(`${name} pair is not left-of-right`);
    if (Math.abs(l.y - r.y) > 0.05) {
      warnings.push(`${name} pair is tilted — check perspective or pose`);
    }
  }

  const shoulderY = (lm.shoulderL.y + lm.shoulderR.y) / 2;
  const pitY = (lm.pitL.y + lm.pitR.y) / 2;
  const hemY = (lm.hemL.y + lm.hemR.y) / 2;
  if (!(shoulderY < pitY && pitY < hemY)) {
    errors.push("vertical order broken: expected shoulder above pit above hem");
  }
  if (lm.waistL && lm.waistR) {
    const waistY = (lm.waistL.y + lm.waistR.y) / 2;
    if (!(pitY < waistY && waistY < hemY)) {
      errors.push("waist line is not between pit and hem");
    }
  }
  if (lm.personTop && lm.personBottom && lm.personTop.y >= lm.personBottom.y) {
    errors.push("person extent inverted");
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Overlay anchors for the ghost mannequin, derived from the DETECTED garment
 * instead of fixed defaults — basis points (hundredths of a percent of image
 * height), matching the schematic overlay's coordinate system.
 */
export function landmarkAnchorsYBp(
  lm: GarmentLandmarks,
): Record<string, number> {
  const bp = (y: number) => Math.round(y * 10_000);
  const anchors: Record<string, number> = {
    shoulder_line: bp((lm.shoulderL.y + lm.shoulderR.y) / 2),
    bust_line: bp((lm.pitL.y + lm.pitR.y) / 2),
    hem: bp((lm.hemL.y + lm.hemR.y) / 2),
  };
  if (lm.waistL && lm.waistR) {
    anchors.waist_line = bp((lm.waistL.y + lm.waistR.y) / 2);
    // Hip sits roughly halfway between waist and hem on a torso garment.
    anchors.hip_line = bp(
      ((lm.waistL.y + lm.waistR.y) / 2 + (lm.hemL.y + lm.hemR.y) / 2) / 2,
    );
  }
  if (lm.neckFront) anchors.neck_front = bp(lm.neckFront.y);
  if (lm.cuffL || lm.cuffR) {
    const c = lm.cuffL ?? lm.cuffR!;
    anchors.cuff = bp(c.y);
  }
  return anchors;
}
