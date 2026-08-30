/**
 * Garment metrology — accurate sizes from photos, honestly.
 *
 * Pipeline (each stage pure and swappable):
 *   capture context → calibration → landmarks (vision adapter) → geometry
 *   (rectify px→inches) → girth model per context → fuse with style prior →
 *   snap to the house grid → grade via the existing sizing engine
 *   (chart-policy enforces physical validity at the end).
 *
 * The vision adapter (garment landmark detection) plugs in at the landmarks
 * stage; everything here is provider-independent mathematics.
 */

export {
  homographyFromPoints,
  applyHomography,
  rectifierFromCard,
  distanceIn,
} from "./geometry";
export type { Point, Homography } from "./geometry";

export {
  flatLayGirthIn,
  onBodyGirthIn,
  ellipsePerimeter,
  BODY_ASPECT_BY_LANDMARK,
  GIRTH_RELATIVE_SD,
  LENGTH_RELATIVE_SD,
} from "./girth";
export type { CaptureContext } from "./girth";

export {
  calibrateWithCard,
  calibrateWithKnownMeasure,
  calibrateWithKnownHeight,
  NO_CALIBRATION,
  measureIn,
} from "./calibrate";
export type { Calibration } from "./calibrate";

export { fuse, isConflicting, measurementEstimate } from "./fuse";
export type { Estimate } from "./fuse";

export { snapToSize } from "./size-snap";
export type { BodyRow, SizeGrid, SizeSnap } from "./size-snap";
