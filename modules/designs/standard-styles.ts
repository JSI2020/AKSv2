import type {
  FitIntent,
  GarmentType,
  LengthBand,
} from "@/modules/dress-sizing/db/enums";

/**
 * A standard style preset for a garment piece. `key`/`lengthBand`/`fitIntent`
 * drive the dress-sizing engine that generates the XS–XXL measurements; `id`
 * is the stable selector value.
 */
export type StylePreset = {
  id: string;
  label: string;
  key: GarmentType;
  lengthBand: LengthBand;
  fitIntent: FitIntent;
};

/**
 * Standard styles grouped by garment-piece category (the size-block category
 * key, e.g. KAMEEZ, TROUSER). Each piece only offers styles that make sense
 * for it, so sizing is done per piece. Plain module (no "use server") so
 * client components can import it.
 */
export const CATEGORY_STYLES: Record<string, StylePreset[]> = {
  KAMEEZ: [
    { id: "short_shirt", label: "Short shirt", key: "short_shirt", lengthBand: "above_knee", fitIntent: "semi_fitted" },
    { id: "long_shirt", label: "Long shirt", key: "short_shirt", lengthBand: "knee", fitIntent: "semi_fitted" },
    { id: "kurti", label: "Kurti — knee length", key: "kurti", lengthBand: "knee", fitIntent: "semi_fitted" },
    { id: "long_kurti", label: "Long kurti", key: "kurti", lengthBand: "below_knee", fitIntent: "relaxed" },
    { id: "angrakha", label: "Angrakha / fitted", key: "kurti", lengthBand: "knee", fitIntent: "fitted" },
  ],
  GOWN: [
    { id: "gown", label: "Gown / maxi", key: "long_gown", lengthBand: "floor", fitIntent: "semi_fitted" },
    { id: "anarkali", label: "Anarkali (flared)", key: "long_gown", lengthBand: "floor", fitIntent: "relaxed" },
    { id: "column_gown", label: "Column gown (slim)", key: "long_gown", lengthBand: "floor", fitIntent: "fitted" },
  ],
  TROUSER: [
    { id: "straight", label: "Straight trouser", key: "trouser", lengthBand: "ankle", fitIntent: "semi_fitted" },
    { id: "cigarette", label: "Cigarette pant", key: "trouser", lengthBand: "ankle", fitIntent: "fitted" },
    { id: "palazzo", label: "Palazzo (wide)", key: "trouser", lengthBand: "floor", fitIntent: "relaxed" },
    { id: "shalwar", label: "Shalwar", key: "trouser", lengthBand: "ankle", fitIntent: "relaxed" },
  ],
  SKIRT: [
    { id: "aline_skirt", label: "A-line skirt", key: "long_gown", lengthBand: "below_knee", fitIntent: "semi_fitted" },
    { id: "farshi_skirt", label: "Farshi / floor skirt", key: "long_gown", lengthBand: "floor", fitIntent: "relaxed" },
  ],
};

export function stylesForCategory(pieceKey: string): StylePreset[] {
  return CATEGORY_STYLES[pieceKey.toUpperCase()] ?? [];
}

export function findStylePreset(
  pieceKey: string,
  styleId: string,
): StylePreset | undefined {
  return stylesForCategory(pieceKey).find((s) => s.id === styleId);
}
