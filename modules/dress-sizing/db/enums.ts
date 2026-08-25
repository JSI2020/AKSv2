/** XS=0 … XXL=5. Shared by grids, styles, and generated charts. */
export const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type StandardSize = (typeof STANDARD_SIZES)[number];
export const DEFAULT_BASE_SIZE = "M" satisfies StandardSize;
export const SIZE_INDEX: Record<StandardSize, number> = {
  XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5,
};

export const BODY_DIMENSIONS = ["bust", "waist", "hip", "shoulder", "height"] as const;
export type BodyDimension = (typeof BODY_DIMENSIONS)[number];
export const FIT_WEIGHT_DIMENSIONS = ["bust", "waist", "hip", "height"] as const;
export type FitWeightDimension = (typeof FIT_WEIGHT_DIMENSIONS)[number];
export const GARMENT_TYPES = ["short_shirt", "long_gown", "kurti", "vest_palazzo", "trouser"] as const;
export type GarmentType = (typeof GARMENT_TYPES)[number];
export const STYLE_CATEGORIES = ["essentials", "modern_tailored", "occasion", "signature", "separates"] as const;
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];
export const POM_KEYS = ["chest", "waist", "hip", "shoulder", "sleeveLength", "garmentLength", "hemWidth", "neckDrop"] as const;
export type PomKey = (typeof POM_KEYS)[number];
export const POM_KINDS = ["girth", "design"] as const;
export type PomKind = (typeof POM_KINDS)[number];
export const LENGTH_BANDS = ["above_knee", "knee", "below_knee", "ankle", "floor"] as const;
export type LengthBand = (typeof LENGTH_BANDS)[number];
export const FIT_INTENTS = ["fitted", "semi_fitted", "relaxed", "oversized"] as const;
export type FitIntent = (typeof FIT_INTENTS)[number];
export const STYLE_STATUSES = ["draft", "published"] as const;
export type StyleStatus = (typeof STYLE_STATUSES)[number];
export const RECOGNITION_STATUSES = ["proposed", "confirmed", "rejected"] as const;
export type RecognitionStatus = (typeof RECOGNITION_STATUSES)[number];
export const FIT_OUTCOMES = ["kept", "returned", "exchanged"] as const;
export type FitOutcome = (typeof FIT_OUTCOMES)[number];
export const FIT_REASONS = ["too_tight", "too_loose", "too_short", "too_long", "other"] as const;
export type FitReason = (typeof FIT_REASONS)[number];
