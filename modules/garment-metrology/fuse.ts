/**
 * Estimate fusion — where "out of the box" becomes engineering.
 *
 * The house already has a good PRIOR for every measurement: the style-template
 * chart composed from the body grid (what the current engine produces). A
 * photo contributes a MEASUREMENT with a known error bar (calibration ×
 * capture-context). Inverse-variance (Bayesian) fusion combines them, so:
 *   - a sharp flat-lay + card photo dominates the template,
 *   - a rough on-model shot nudges it,
 *   - no usable photo leaves the template untouched.
 * The engine is therefore never WORSE than today's, and better whenever the
 * photo is good — with an explicit confidence attached to every number.
 */

export type Estimate = {
  /** Hundredths of an inch. */
  value: number;
  /** 1σ, hundredths of an inch. */
  sd: number;
};

export function fuse(prior: Estimate, measurement: Estimate): Estimate {
  if (!Number.isFinite(measurement.sd) || measurement.sd <= 0) return prior;
  if (!Number.isFinite(prior.sd) || prior.sd <= 0) return measurement;
  const wp = 1 / (prior.sd * prior.sd);
  const wm = 1 / (measurement.sd * measurement.sd);
  return {
    value: Math.round((prior.value * wp + measurement.value * wm) / (wp + wm)),
    sd: Math.sqrt(1 / (wp + wm)),
  };
}

/**
 * Disagreement gate: when the photo and the prior disagree by more than
 * `k` combined sigmas, do NOT silently average two irreconcilable stories —
 * flag for human review (wrong style detected, wrong calibration, or a
 * genuinely unusual garment).
 */
export function isConflicting(
  prior: Estimate,
  measurement: Estimate,
  k = 3,
): boolean {
  if (!Number.isFinite(measurement.sd) || !Number.isFinite(prior.sd)) return false;
  const combined = Math.hypot(prior.sd, measurement.sd);
  return Math.abs(prior.value - measurement.value) > k * combined;
}

/** Build a measurement Estimate from a raw inch value and relative error. */
export function measurementEstimate(
  valueIn: number,
  ...relativeSds: number[]
): Estimate {
  const rel = Math.sqrt(relativeSds.reduce((s, r) => s + r * r, 0));
  const hundredths = Math.round(valueIn * 100);
  return { value: hundredths, sd: Math.max(1, Math.abs(hundredths) * rel) };
}
