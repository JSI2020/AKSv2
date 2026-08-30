/**
 * Width → circumference models. The physically honest part of photo sizing:
 * a photo shows a 2-D span; a size-chart value is a 3-D girth. How the one
 * becomes the other depends entirely on HOW the garment was photographed —
 * so each capture context gets its own geometry, with its own error bar.
 */

export type CaptureContext = "flat_lay" | "on_model" | "on_mannequin" | "hanging";

/**
 * FLAT-LAY (the accurate path): a garment lying flat is a flattened tube —
 * the circumference is exactly twice the flat width (pit-to-pit ×2 is how
 * professional garment QC measures chest). No anatomical assumption at all.
 */
export function flatLayGirthIn(flatWidthIn: number): number {
  return 2 * flatWidthIn;
}

/**
 * ON-MODEL / ON-MANNEQUIN (the estimated path): the visible width is the
 * ellipse's major axis; depth must be assumed. Adult female torso
 * cross-sections are flatter at the bust and rounder toward the hip —
 * depth/width aspect ratios below follow anthropometric survey ranges
 * (e.g. ANSUR-class data). These are PRIORS, not measurements: girths from
 * this path carry an inherent ±1–1.5″ uncertainty and should be fused with
 * the style prior, never trusted alone.
 */
export const BODY_ASPECT_BY_LANDMARK: Record<string, number> = {
  bust: 0.7,
  chest: 0.7,
  waist: 0.74,
  hip: 0.78,
  /**
   * A hem hangs free — its cross-section is a cone/cylinder section, close to
   * circular, not a body section. Using the hip's 0.78 here understates the
   * sweep badly (a floor-length gown reads ~10% narrower than it is).
   */
  hem: 0.97,
  sweep: 0.97,
  neck: 0.85,
  thigh: 0.9,
  upper_arm: 0.95,
};

/** Ramanujan's first approximation for an ellipse perimeter. */
export function ellipsePerimeter(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

export function onBodyGirthIn(
  visibleWidthIn: number,
  landmark: string,
  aspectOverride?: number,
): number {
  const aspect = aspectOverride ?? BODY_ASPECT_BY_LANDMARK[landmark] ?? 0.78;
  const a = visibleWidthIn / 2;
  const b = a * aspect;
  return ellipsePerimeter(a, b);
}

/** Per-context 1σ relative uncertainty for a girth measurement. */
export const GIRTH_RELATIVE_SD: Record<CaptureContext, number> = {
  flat_lay: 0.015, // ~±0.7″ on a 45″ sweep; mostly landmark placement error
  on_mannequin: 0.035,
  on_model: 0.05, // pose, cloth drape, breathing — the honest error bar
  hanging: 0.08, // cloth folds; use only as a last resort
};

/** Vertical measures (lengths) read directly once rectified — tighter error. */
export const LENGTH_RELATIVE_SD: Record<CaptureContext, number> = {
  flat_lay: 0.01,
  on_mannequin: 0.02,
  on_model: 0.03,
  hanging: 0.03,
};
