/**
 * Canonical measurement keys and default category → key sets.
 * Values elsewhere are integer hundredths of an inch — never floats.
 */

export const BODY_OR_GARMENT = ["BODY", "GARMENT"] as const;
export type BodyOrGarment = (typeof BODY_OR_GARMENT)[number];

export type MeasurementKeyDef = {
  key: string;
  label: string;
  labelUr: string;
  bodyOrGarment: BodyOrGarment;
  /** Overlay / visual guide anchor (e.g. shoulder line for LENGTH). */
  anchorPoint: string;
  helpText: string;
};

/** Union of every key used by any seeded category. */
export const MEASUREMENT_KEY_DEFS: readonly MeasurementKeyDef[] = [
  {
    key: "BUST",
    label: "Bust",
    labelUr: "سینہ",
    bodyOrGarment: "BODY",
    anchorPoint: "bust_line",
    helpText: "Fullest part of the bust, tape level and parallel to the floor.",
  },
  {
    key: "WAIST",
    label: "Waist",
    labelUr: "کمر",
    bodyOrGarment: "BODY",
    anchorPoint: "waist_line",
    helpText: "Natural waist — narrowest point between ribs and hips.",
  },
  {
    key: "HIP",
    label: "Hip",
    labelUr: "کولہا",
    bodyOrGarment: "BODY",
    anchorPoint: "hip_line",
    helpText: "Fullest part of the hips, typically 7–9″ below the waist.",
  },
  {
    key: "SHOULDER",
    label: "Shoulder",
    labelUr: "کندھا",
    bodyOrGarment: "BODY",
    anchorPoint: "shoulder_line",
    helpText: "Point-to-point across the back of the shoulders.",
  },
  {
    key: "SLEEVE_LENGTH",
    label: "Sleeve length",
    labelUr: "آستین کی لمبائی",
    bodyOrGarment: "GARMENT",
    anchorPoint: "shoulder_point",
    helpText: "From shoulder point to the desired sleeve end.",
  },
  {
    key: "SLEEVE_OPENING",
    label: "Sleeve opening",
    labelUr: "آستین کا منہ",
    bodyOrGarment: "GARMENT",
    anchorPoint: "cuff",
    helpText: "Finished circumference at the sleeve opening / cuff.",
  },
  {
    key: "ARMHOLE",
    label: "Armhole",
    labelUr: "بازو کا سوراخ",
    bodyOrGarment: "GARMENT",
    anchorPoint: "armhole",
    helpText: "Armhole circumference of the finished garment.",
  },
  {
    key: "NECK_DEPTH_FRONT",
    label: "Neck depth (front)",
    labelUr: "گلا سامنے",
    bodyOrGarment: "GARMENT",
    anchorPoint: "neck_front",
    helpText: "Drop from the high point of the shoulder to the front neckline.",
  },
  {
    key: "NECK_DEPTH_BACK",
    label: "Neck depth (back)",
    labelUr: "گلا پیچھے",
    bodyOrGarment: "GARMENT",
    anchorPoint: "neck_back",
    helpText: "Drop from the high point of the shoulder to the back neckline.",
  },
  {
    key: "LENGTH",
    label: "Length",
    labelUr: "لمبائی",
    bodyOrGarment: "GARMENT",
    anchorPoint: "shoulder_line",
    helpText:
      "Design length — not a body measurement. Short and long silhouettes share one category.",
  },
  {
    key: "THIGH",
    label: "Thigh",
    labelUr: "ران",
    bodyOrGarment: "BODY",
    anchorPoint: "thigh",
    helpText: "Fullest part of the thigh, parallel to the floor.",
  },
  {
    key: "RISE",
    label: "Rise",
    labelUr: "رائز",
    bodyOrGarment: "GARMENT",
    anchorPoint: "waist_line",
    helpText: "From waist to crotch seam along the body.",
  },
  {
    key: "BOTTOM_OPENING",
    label: "Bottom opening",
    labelUr: "پائنچے کا منہ",
    bodyOrGarment: "GARMENT",
    anchorPoint: "hem",
    helpText: "Finished circumference at the trouser hem.",
  },
  {
    key: "SWEEP",
    label: "Sweep",
    labelUr: "سویپ",
    bodyOrGarment: "GARMENT",
    anchorPoint: "hem",
    helpText: "Finished circumference / flare at the hem (gown or skirt).",
  },
  {
    key: "WIDTH",
    label: "Width",
    labelUr: "چوڑائی",
    bodyOrGarment: "GARMENT",
    anchorPoint: "centre",
    helpText: "Finished width of the dupatta.",
  },
] as const;

export type MeasurementKeyCode = (typeof MEASUREMENT_KEY_DEFS)[number]["key"];

export const MEASUREMENT_KEY_CODES: readonly MeasurementKeyCode[] =
  MEASUREMENT_KEY_DEFS.map((d) => d.key);

export type CategorySeed = {
  key: string;
  name: string;
  nameUr: string;
  measurementKeys: readonly MeasurementKeyCode[];
  sortOrder: number;
};

/** Exact key sets from AKS_BUILD_02 Step 13. */
export const GARMENT_CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    key: "KAMEEZ",
    name: "Kameez",
    nameUr: "قمیض",
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
    sortOrder: 10,
  },
  {
    key: "TROUSER",
    name: "Trouser",
    nameUr: "شلوار",
    measurementKeys: [
      "WAIST",
      "HIP",
      "THIGH",
      "RISE",
      "LENGTH",
      "BOTTOM_OPENING",
    ],
    sortOrder: 20,
  },
  {
    key: "GOWN",
    name: "Gown",
    nameUr: "گاؤن",
    measurementKeys: [
      "BUST",
      "WAIST",
      "HIP",
      "SHOULDER",
      "SLEEVE_LENGTH",
      "ARMHOLE",
      "NECK_DEPTH_FRONT",
      "NECK_DEPTH_BACK",
      "LENGTH",
      "SWEEP",
    ],
    sortOrder: 30,
  },
  {
    key: "SKIRT",
    name: "Skirt",
    nameUr: "اسکرٹ",
    measurementKeys: ["WAIST", "HIP", "LENGTH", "SWEEP"],
    sortOrder: 40,
  },
  {
    key: "DUPATTA",
    name: "Dupatta",
    nameUr: "دوپٹہ",
    measurementKeys: ["LENGTH", "WIDTH"],
    sortOrder: 50,
  },
  {
    key: "SHALWAR",
    name: "Shalwar",
    nameUr: "شلوار",
    measurementKeys: [
      "WAIST",
      "HIP",
      "THIGH",
      "RISE",
      "LENGTH",
      "BOTTOM_OPENING",
    ],
    sortOrder: 60,
  },
  {
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
    sortOrder: 70,
  },
] as const;

export function isMeasurementKeyCode(value: string): value is MeasurementKeyCode {
  return (MEASUREMENT_KEY_CODES as readonly string[]).includes(value);
}
