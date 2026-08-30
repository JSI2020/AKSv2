/**
 * Photo-only estimation — the best possible answer when the ONLY input is one
 * uploaded photo (no calibration card, no stated heights).
 *
 * Mathematics of the situation: a lone photo fixes PROPORTIONS precisely but
 * absolute scale not at all. So scale is anchored on the strongest available
 * prior — the visible person's height (house body grid) when someone is in
 * frame, otherwise the style template's garment length — and every other
 * measurement is transferred through the photo's measured ratios:
 *
 *     measurement ≈ anchorInches × (span_px / anchor_px)   [× girth model]
 *
 * then fused (inverse-variance) with that measurement's own template prior.
 * The anchor's uncertainty propagates into every derived value, so the fusion
 * automatically trusts the photo more for RATIO-dominated measures and the
 * template more when the anchor is weak. Conflicts flag for review.
 */

import {
  flatLayGirthIn,
  onBodyGirthIn,
  GIRTH_RELATIVE_SD,
  LENGTH_RELATIVE_SD,
  type CaptureContext,
} from "./girth";
import { fuse, isConflicting, type Estimate } from "./fuse";
import type { GarmentLandmarks, NormPoint } from "./landmarks";

/** POM keys shared with the dress-sizing composer. */
export type PhotoPomKey =
  | "chest"
  | "waist"
  | "shoulder"
  | "garmentLength"
  | "sleeveLength"
  | "hemWidth"
  | "neckDrop";

export type PhotoEstimateInput = {
  landmarks: GarmentLandmarks;
  imageWidthPx: number;
  imageHeightPx: number;
  /** Template prior at the base size, POM key → Estimate (hundredths). */
  prior: Partial<Record<PhotoPomKey, Estimate>>;
  /**
   * Height prior for a person/mannequin in frame, hundredths of an inch.
   * Defaults to the house base-size body height (M = 64").
   */
  personHeight?: Estimate;
};

export type PhotoEstimateResult = {
  /** Prior ⊕ photo, per POM key — the values to write. */
  fused: Partial<Record<PhotoPomKey, Estimate>>;
  /** The raw photo-derived values, for the review overlay. */
  measured: Partial<Record<PhotoPomKey, Estimate>>;
  /** POM keys where photo and prior tell irreconcilable stories. */
  conflicts: PhotoPomKey[];
  anchor: { kind: "person_height" | "garment_length_prior"; relativeSd: number };
};

/**
 * Height of the person in a garment photo — NOT the house body grid's M height.
 * The size grid's 64" describes a customer; the woman in a product photo is a
 * fashion/product model, typically 5'8"–5'10". Assuming 64" for a 69" model
 * scales every measurement down by ~7% (a true 55" gown reads as 51"), which is
 * enough to push real measurements past the conflict gate and get them thrown
 * away. Default to the photographic norm with an honest error bar, and let
 * callers pass the real figure when they know it (the studio stores its
 * archetype's height).
 */
const DEFAULT_PERSON_HEIGHT: Estimate = { value: 6800, sd: 300 }; // 68" ± 3"

/**
 * Relative 1σ of the style-template prior per POM — how much the composed
 * chart can be wrong when the vision model picks a neighbouring style bucket.
 * Calibrated from the template's own step sizes: one fit-intent step is ~3" of
 * ease on a ~45" girth (~6%), one hem-landmark step is ~6" of length, and neck
 * drop swings hardest between shapes.
 */
export const TEMPLATE_PRIOR_RELATIVE_SD: Record<PhotoPomKey, number> = {
  chest: 0.05,
  waist: 0.05,
  hemWidth: 0.06,
  shoulder: 0.04,
  garmentLength: 0.06,
  sleeveLength: 0.08,
  neckDrop: 0.15,
};

/** Wrap a composed template value as a prior Estimate with its error bar. */
export function templatePrior(
  key: PhotoPomKey,
  valueHundredths: number,
): Estimate {
  const rel = TEMPLATE_PRIOR_RELATIVE_SD[key] ?? 0.06;
  return {
    value: valueHundredths,
    sd: Math.max(1, Math.abs(valueHundredths) * rel),
  };
}

/** Landmark placement noise (1σ, relative) — how precisely points get set. */
const PLACEMENT_SD = 0.015;

function px(p: NormPoint, w: number, h: number): { x: number; y: number } {
  return { x: p.x * w, y: p.y * h };
}

function dist(a: NormPoint, b: NormPoint, w: number, h: number): number {
  const pa = px(a, w, h);
  const pb = px(b, w, h);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

export function estimateFromPhoto(
  input: PhotoEstimateInput,
): PhotoEstimateResult {
  const { landmarks: lm, imageWidthPx: w, imageHeightPx: h, prior } = input;
  const ctx: CaptureContext = lm.captureContext;

  // ---- 1. Anchor: pixels-per-inch with its own uncertainty -----------------
  let anchorPx: number;
  let anchorIn: Estimate;
  let anchorKind: PhotoEstimateResult["anchor"]["kind"];

  const shoulderMid: NormPoint = {
    x: (lm.shoulderL.x + lm.shoulderR.x) / 2,
    y: (lm.shoulderL.y + lm.shoulderR.y) / 2,
  };
  const hemMid: NormPoint = {
    x: (lm.hemL.x + lm.hemR.x) / 2,
    y: (lm.hemL.y + lm.hemR.y) / 2,
  };

  if (
    (ctx === "on_model" || ctx === "on_mannequin") &&
    lm.personTop &&
    lm.personBottom
  ) {
    anchorPx = dist(lm.personTop, lm.personBottom, w, h);
    anchorIn = input.personHeight ?? DEFAULT_PERSON_HEIGHT;
    anchorKind = "person_height";
  } else {
    const lengthPrior = prior.garmentLength;
    if (!lengthPrior) {
      throw new Error(
        "Photo-only estimation needs either a person in frame or a garment-length prior",
      );
    }
    anchorPx = dist(shoulderMid, hemMid, w, h);
    anchorIn = lengthPrior;
    anchorKind = "garment_length_prior";
  }
  if (anchorPx <= 0) throw new Error("Anchor span has no pixel extent");

  const anchorRelSd = anchorIn.sd / anchorIn.value;
  const ppi = anchorPx / (anchorIn.value / 100);

  // ---- 2. Spans → inch estimates ------------------------------------------
  const measured: Partial<Record<PhotoPomKey, Estimate>> = {};

  const girthSd = GIRTH_RELATIVE_SD[ctx];
  const lengthSd = LENGTH_RELATIVE_SD[ctx];

  const record = (
    key: PhotoPomKey,
    valueIn: number,
    ...rels: number[]
  ): void => {
    const rel = Math.sqrt(
      rels.reduce((s, r) => s + r * r, PLACEMENT_SD * PLACEMENT_SD),
    );
    const hundredths = Math.round(valueIn * 100);
    if (hundredths <= 0) return;
    measured[key] = { value: hundredths, sd: Math.max(1, hundredths * rel) };
  };

  const widthToGirth = (widthIn: number, landmark: string): number =>
    ctx === "flat_lay"
      ? flatLayGirthIn(widthIn)
      : onBodyGirthIn(widthIn, landmark);

  const chestWidthIn = dist(lm.pitL, lm.pitR, w, h) / ppi;
  record("chest", widthToGirth(chestWidthIn, "bust"), girthSd, anchorRelSd);

  if (lm.waistL && lm.waistR) {
    const waistWidthIn = dist(lm.waistL, lm.waistR, w, h) / ppi;
    record("waist", widthToGirth(waistWidthIn, "waist"), girthSd, anchorRelSd);
  }

  const hemWidthIn = dist(lm.hemL, lm.hemR, w, h) / ppi;
  record("hemWidth", widthToGirth(hemWidthIn, "hem"), girthSd, anchorRelSd);

  const shoulderIn = dist(lm.shoulderL, lm.shoulderR, w, h) / ppi;
  record("shoulder", shoulderIn, lengthSd, anchorRelSd);

  // Length is exact when it IS the anchor; ratio-derived otherwise.
  const lengthIn = dist(shoulderMid, hemMid, w, h) / ppi;
  record(
    "garmentLength",
    lengthIn,
    lengthSd,
    anchorKind === "garment_length_prior" ? anchorRelSd : anchorRelSd,
  );

  if (lm.cuffL || lm.cuffR) {
    const cuff = lm.cuffL ?? lm.cuffR!;
    const from = cuff === lm.cuffL ? lm.shoulderL : lm.shoulderR;
    record("sleeveLength", dist(from, cuff, w, h) / ppi, lengthSd, anchorRelSd);
  }

  if (lm.neckTop && lm.neckFront) {
    record(
      "neckDrop",
      Math.abs(px(lm.neckFront, w, h).y - px(lm.neckTop, w, h).y) / ppi,
      lengthSd,
      anchorRelSd,
    );
  }

  // ---- 3. Fuse with the template prior ------------------------------------
  const fused: Partial<Record<PhotoPomKey, Estimate>> = {};
  const conflicts: PhotoPomKey[] = [];
  const keys = new Set<PhotoPomKey>([
    ...(Object.keys(prior) as PhotoPomKey[]),
    ...(Object.keys(measured) as PhotoPomKey[]),
  ]);
  for (const key of keys) {
    const p = prior[key];
    const m = measured[key];
    if (p && m && isConflicting(p, m)) {
      conflicts.push(key);
      fused[key] = p; // never silently average irreconcilable stories
      continue;
    }
    if (p && m) fused[key] = fuse(p, m);
    else fused[key] = (p ?? m)!;
  }

  return {
    fused,
    measured,
    conflicts,
    anchor: { kind: anchorKind, relativeSd: anchorRelSd },
  };
}
