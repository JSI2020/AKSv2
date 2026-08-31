/**
 * Canonical measurement keys and garment categories.
 * Research pack (Aug 2026) in data/sizing-research/ — regenerate via
 * `npm run db:generate:sizing-research`.
 * Values elsewhere are integer hundredths of an inch (or metre) — never floats.
 */

import { RESEARCH_GARMENT_CATEGORY_SEEDS } from "./sizing-research/research-categories";
import { RESEARCH_MEASUREMENT_KEY_DEFS } from "./sizing-research/research-measurement-keys";

export const BODY_OR_GARMENT = ["BODY", "GARMENT"] as const;
export type BodyOrGarment = (typeof BODY_OR_GARMENT)[number];

export type MeasurementKeyDef = {
  key: string;
  label: string;
  labelUr: string;
  bodyOrGarment: BodyOrGarment;
  anchorPoint: string;
  helpText: string;
};

/** Urdu labels and richer help text for keys that existed before the research pack. */
const LEGACY_KEY_OVERRIDES: Partial<
  Record<string, Pick<MeasurementKeyDef, "labelUr" | "helpText" | "anchorPoint">>
> = {
  BUST: {
    labelUr: "سینہ",
    anchorPoint: "bust_line",
    helpText:
      "Fullest part of the bust, tape level and parallel to the floor.",
  },
  WAIST: {
    labelUr: "کمر",
    anchorPoint: "waist_line",
    helpText: "Natural waist — narrowest point between ribs and hips.",
  },
  HIP: {
    labelUr: "کولہا",
    anchorPoint: "hip_line",
    helpText: "Fullest part of the hips, typically 7–9″ below the waist.",
  },
  SHOULDER: {
    labelUr: "کندھا",
    anchorPoint: "shoulder_line",
    helpText: "Point-to-point across the back of the shoulders.",
  },
  SLEEVE_LENGTH: {
    labelUr: "آستین کی لمبائی",
    anchorPoint: "shoulder_point",
    helpText: "From shoulder point to the desired sleeve end.",
  },
  SLEEVE_OPENING: {
    labelUr: "آستین کا منہ",
    anchorPoint: "cuff",
    helpText: "Finished circumference at the sleeve opening / cuff.",
  },
  ARMHOLE: {
    labelUr: "بازو کا سوراخ",
    anchorPoint: "armhole",
    helpText: "Armhole circumference of the finished garment.",
  },
  NECK_DEPTH_FRONT: {
    labelUr: "گلا سامنے",
    anchorPoint: "neck_front",
    helpText:
      "Drop from the high point of the shoulder to the front neckline.",
  },
  NECK_DEPTH_BACK: {
    labelUr: "گلا پیچھے",
    anchorPoint: "neck_back",
    helpText:
      "Drop from the high point of the shoulder to the back neckline.",
  },
  LENGTH: {
    labelUr: "لمبائی",
    anchorPoint: "shoulder_line",
    helpText:
      "Design length — not a body measurement. Short and long silhouettes share one category.",
  },
  THIGH: {
    labelUr: "ران",
    anchorPoint: "thigh",
    helpText: "Fullest part of the thigh, parallel to the floor.",
  },
  RISE: {
    labelUr: "رائز",
    anchorPoint: "waist_line",
    helpText: "From waist to crotch seam along the body.",
  },
  BOTTOM_OPENING: {
    labelUr: "پائنچے کا منہ",
    anchorPoint: "hem",
    helpText: "Finished circumference at the trouser hem.",
  },
  SWEEP: {
    labelUr: "سویپ",
    anchorPoint: "hem",
    helpText: "Finished circumference / flare at the hem (gown or skirt).",
  },
  WIDTH: {
    labelUr: "چوڑائی",
    anchorPoint: "centre",
    helpText: "Finished width of the dupatta or fabric piece.",
  },
};

export const MEASUREMENT_KEY_DEFS: readonly MeasurementKeyDef[] =
  RESEARCH_MEASUREMENT_KEY_DEFS.map((def) => ({
    ...def,
    ...LEGACY_KEY_OVERRIDES[def.key],
  }));

export type MeasurementKeyCode = (typeof MEASUREMENT_KEY_DEFS)[number]["key"];

export const MEASUREMENT_KEY_CODES: readonly MeasurementKeyCode[] =
  MEASUREMENT_KEY_DEFS.map((d) => d.key);

export type CategorySeed = {
  key: string;
  name: string;
  nameUr: string;
  measurementKeys: readonly string[];
  sortOrder: number;
  /** Research pack — wearable | set | fabric | accessory */
  productType?: string;
  typicalRange?: string;
  evidenceStatus?: string;
  definition?: string;
};

/** Legacy alias — maps to straight shirt keys for existing designs. */
const LEGACY_SHIRT: CategorySeed = {
  key: "SHIRT",
  name: "Shirt",
  nameUr: "شرٹ",
  measurementKeys: [
    "BUST",
    "WAIST",
    "HIP",
    "SHOULDER",
    "SLEEVE_LENGTH",
    "SLEEVE_OPENING",
    "ARMHOLE",
    "NECK_DEPTH_FRONT",
    "NECK_DEPTH_BACK",
    "LENGTH",
  ],
  sortOrder: 710,
  productType: "wearable",
  typicalRange: "XS-XXL",
  evidenceStatus: "Confirmed",
  definition: "Legacy alias — use Straight Shirt or A-line Shirt for new designs.",
};

export const GARMENT_CATEGORY_SEEDS: readonly CategorySeed[] = [
  ...RESEARCH_GARMENT_CATEGORY_SEEDS,
  LEGACY_SHIRT,
];

export function isMeasurementKeyCode(value: string): value is MeasurementKeyCode {
  return (MEASUREMENT_KEY_CODES as readonly string[]).includes(value);
}
