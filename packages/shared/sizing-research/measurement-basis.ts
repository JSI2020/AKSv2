/**
 * Measurement basis — the single most important thing to get right about a
 * size chart, and the thing that was silently wrong.
 *
 * A garment laid flat shows HALF of anything that closes into a loop: the tape
 * across the chest of a folded kameez reads 20", the finished chest is 40".
 * Spans that are not loops — shoulder point-to-point, garment length, sleeve
 * length — read in full whether the garment is flat or worn.
 *
 * The captured research blocks are NOT consistent: the kameez chart was taken
 * flat (bust 20.00"), while the kurti, pant and lehenga charts already hold
 * finished circumferences (hip 38.00"). Storing both under the same keys made
 * every comparison meaningless and put half-values into charts that are read as
 * full ones.
 *
 * Canonical basis for every stored chart: FINISHED CIRCUMFERENCE for loops,
 * actual length for spans.
 */

/**
 * Torso loops, where flat-versus-finished is unambiguous and the error is
 * large enough to matter. Smaller loops (armhole, cuff) are left alone: their
 * captured basis is ambiguous and a wrong doubling would do more harm than the
 * inconsistency it fixes.
 */
const TORSO_LOOP =
  /^(BUST|CHEST|WAIST|HIP|SWEEP|DAMAN)$|_(BUST|CHEST|WAIST|HIP)$|^(UPPER|LOWER|BOTTOM|TOP)_(WAIST|HIP)$/;

/**
 * No adult house garment has a finished chest, waist or hip loop under 30".
 * A flat-laid half of those same measurements is never above 30" either, so
 * the magnitude tells us which basis a captured value is already in.
 */
const FINISHED_LOOP_FLOOR_HUNDREDTHS = 3000;

export function isTorsoLoop(key: string): boolean {
  return TORSO_LOOP.test(key);
}

/**
 * Was this row captured flat? Decided from the BASE value, then applied to the
 * row's grade increment and overrides too, so a run never mixes bases.
 */
export function isFlatCapturedRow(key: string, baseValueHundredths: number): boolean {
  return isTorsoLoop(key) && baseValueHundredths < FINISHED_LOOP_FLOOR_HUNDREDTHS;
}

/** Convert a flat-captured value into the finished circumference charts store. */
export function flatToFinished(
  key: string,
  valueHundredths: number,
  baseValueHundredths: number = valueHundredths,
): number {
  return isFlatCapturedRow(key, baseValueHundredths)
    ? valueHundredths * 2
    : valueHundredths;
}
