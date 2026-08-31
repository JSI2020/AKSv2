/**
 * Which part of the body a garment covers.
 *
 * The ghost mannequin is an upper-body form: it holds a shoulder line, an
 * armhole and a neckline, which is what makes an invisible-mannequin shot read
 * as a garment. A trouser, palazzo or skirt has none of those — generating one
 * produces a shape with nothing to hang from, so the ghost is offered only for
 * garments the form can actually carry.
 */

export type BodyRegion = "upper" | "lower" | "none";

/** Bottoms — worn from the waist down, no shoulder or armhole. */
const LOWER_BODY = new Set([
  "TROUSER",
  "PANT",
  "PALAZZO",
  "SHALWAR",
  "CAPRI",
  "CULOTTE",
  "SHARARA",
  "GHARARA",
  "SKIRT",
  "LEHENGA",
]);

/** Yardage and flat drapes — not a fitted garment at all. */
const NOT_A_GARMENT = new Set([
  "DUPATTA",
  "SHAWL",
  "SAREE",
  "UNSTITCHED_1PC",
  "UNSTITCHED_2PC",
  "UNSTITCHED_3PC",
]);

export function bodyRegionForCategory(categoryKey: string): BodyRegion {
  const key = categoryKey.trim().toUpperCase();
  if (NOT_A_GARMENT.has(key)) return "none";
  if (LOWER_BODY.has(key)) return "lower";
  return "upper";
}

/**
 * True when a ghost-mannequin render makes sense for this category. Everything
 * that hangs from the shoulders qualifies; bottoms and flat drapes do not.
 */
export function supportsGhostMannequin(categoryKey: string): boolean {
  return bodyRegionForCategory(categoryKey) === "upper";
}
