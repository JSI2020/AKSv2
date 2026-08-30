/**
 * Scale calibration strategies — every photo needs exactly one, and the
 * engine's honesty comes from knowing how good each one is.
 *
 * Ranked by accuracy:
 *  1. card      — a known rectangle in frame (A4 sheet / printed card):
 *                 full homography ⇒ perspective correction + scale. ~0.5% error.
 *  2. known_measure — the user states ONE true measurement (e.g. "length is
 *                 44″"); everything else scales from its pixel span. ~2%.
 *  3. known_height — model's stated height spans head-to-floor pixels. ~3–4%
 *                 (posture, hair, camera tilt).
 *  4. none      — no scale: the photo can only contribute PROPORTIONS; girths
 *                 come from the style prior alone.
 */

import { rectifierFromCard, distanceIn, type Point } from "./geometry";

export type Calibration = {
  kind: "card" | "known_measure" | "known_height" | "none";
  /** Map an image point to inch-plane coordinates (identity×scale for scalar kinds). */
  toInches: (p: Point) => Point;
  /** 1σ relative scale uncertainty this strategy contributes. */
  relativeSd: number;
};

export function calibrateWithCard(
  corners: readonly [Point, Point, Point, Point],
  cardWidthIn: number,
  cardHeightIn: number,
): Calibration {
  const rectify = rectifierFromCard(corners, cardWidthIn, cardHeightIn);
  return { kind: "card", toInches: rectify, relativeSd: 0.005 };
}

function scalar(pxPerInch: number, kind: Calibration["kind"], sd: number): Calibration {
  return {
    kind,
    toInches: (p) => ({ x: p.x / pxPerInch, y: p.y / pxPerInch }),
    relativeSd: sd,
  };
}

export function calibrateWithKnownMeasure(
  spanA: Point,
  spanB: Point,
  trueInches: number,
): Calibration {
  const px = Math.hypot(spanA.x - spanB.x, spanA.y - spanB.y);
  if (px <= 0 || trueInches <= 0) throw new Error("Invalid calibration span");
  return scalar(px / trueInches, "known_measure", 0.02);
}

export function calibrateWithKnownHeight(
  headTop: Point,
  floorAtFeet: Point,
  statedHeightIn: number,
): Calibration {
  const px = Math.abs(floorAtFeet.y - headTop.y);
  if (px <= 0 || statedHeightIn <= 0) throw new Error("Invalid height span");
  return scalar(px / statedHeightIn, "known_height", 0.035);
}

export const NO_CALIBRATION: Calibration = {
  kind: "none",
  toInches: (p) => p,
  relativeSd: Number.POSITIVE_INFINITY,
};

/** Measure the real distance between two image points under a calibration. */
export function measureIn(cal: Calibration, a: Point, b: Point): number {
  return distanceIn(cal.toInches(a), cal.toInches(b));
}
