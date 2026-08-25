import type { FitIntent, GarmentType, LengthBand, PomKey, StyleStatus } from "../db/enums";

export const GARMENT_LABELS: Record<GarmentType, string> = {
  short_shirt: "Short shirt", long_gown: "Long gown", kurti: "Kurti",
  vest_palazzo: "Vest + palazzo", trouser: "Trouser",
};
export const LENGTH_LABELS: Record<LengthBand, string> = {
  above_knee: "Above knee", knee: "Knee", below_knee: "Below knee", ankle: "Ankle", floor: "Floor",
};
export const FIT_LABELS: Record<FitIntent, string> = {
  fitted: "Fitted", semi_fitted: "Regular", relaxed: "Relaxed", oversized: "Oversized",
};
export const POM_LABELS: Record<PomKey, string> = {
  chest: "Chest", waist: "Waist", hip: "Hip", shoulder: "Shoulder",
  sleeveLength: "Sleeve", garmentLength: "Length", hemWidth: "Hem", neckDrop: "Neck",
};
export const STATUS_LABELS: Record<StyleStatus, string> = { draft: "Draft", published: "Live" };
