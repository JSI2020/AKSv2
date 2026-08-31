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
  // ---- Upper-body pieces -------------------------------------------------
  KURTA: [
    { id: "kurta_knee", label: "Kurta — knee length", key: "kurti", lengthBand: "knee", fitIntent: "semi_fitted" },
    { id: "kurta_long", label: "Long kurta", key: "kurti", lengthBand: "below_knee", fitIntent: "relaxed" },
    { id: "kurta_short", label: "Short kurta", key: "kurti", lengthBand: "above_knee", fitIntent: "semi_fitted" },
  ],
  KURTI: [
    { id: "kurti_short", label: "Kurti — above knee", key: "kurti", lengthBand: "above_knee", fitIntent: "semi_fitted" },
    { id: "kurti_knee", label: "Kurti — knee length", key: "kurti", lengthBand: "knee", fitIntent: "semi_fitted" },
    { id: "kurti_fitted", label: "Fitted kurti", key: "kurti", lengthBand: "knee", fitIntent: "fitted" },
  ],
  SHIRT: [
    { id: "shirt_short", label: "Short shirt", key: "short_shirt", lengthBand: "above_knee", fitIntent: "semi_fitted" },
    { id: "shirt_long", label: "Long shirt", key: "short_shirt", lengthBand: "knee", fitIntent: "semi_fitted" },
    { id: "shirt_relaxed", label: "Relaxed shirt", key: "short_shirt", lengthBand: "above_knee", fitIntent: "relaxed" },
  ],
  STRAIGHT_SHIRT: [
    { id: "straight_shirt", label: "Straight shirt", key: "short_shirt", lengthBand: "knee", fitIntent: "semi_fitted" },
    { id: "straight_shirt_long", label: "Straight shirt — long", key: "short_shirt", lengthBand: "below_knee", fitIntent: "relaxed" },
  ],
  A_LINE_SHIRT: [
    { id: "aline_shirt", label: "A-line shirt", key: "kurti", lengthBand: "knee", fitIntent: "semi_fitted" },
    { id: "aline_shirt_long", label: "A-line shirt — long", key: "kurti", lengthBand: "below_knee", fitIntent: "relaxed" },
  ],
  ANGRAKHA: [
    { id: "angrakha_knee", label: "Angrakha — knee length", key: "kurti", lengthBand: "knee", fitIntent: "fitted" },
    { id: "angrakha_long", label: "Angrakha — long", key: "kurti", lengthBand: "below_knee", fitIntent: "semi_fitted" },
  ],
  BLOUSE_CHOLI: [
    { id: "choli", label: "Choli / fitted blouse", key: "short_shirt", lengthBand: "above_knee", fitIntent: "fitted" },
  ],
  WAISTCOAT: [
    { id: "waistcoat", label: "Waistcoat", key: "vest_palazzo", lengthBand: "above_knee", fitIntent: "semi_fitted" },
    { id: "waistcoat_long", label: "Longline waistcoat", key: "vest_palazzo", lengthBand: "knee", fitIntent: "relaxed" },
  ],
  JACKET: [
    { id: "jacket", label: "Jacket", key: "short_shirt", lengthBand: "above_knee", fitIntent: "semi_fitted" },
    { id: "duster", label: "Duster / long jacket", key: "vest_palazzo", lengthBand: "below_knee", fitIntent: "relaxed" },
  ],
  CAPE: [
    { id: "cape", label: "Cape", key: "vest_palazzo", lengthBand: "above_knee", fitIntent: "relaxed" },
    { id: "cape_long", label: "Long cape", key: "vest_palazzo", lengthBand: "knee", fitIntent: "oversized" },
  ],

  // ---- Full-length pieces -------------------------------------------------
  ABAYA: [
    { id: "abaya", label: "Abaya — column", key: "long_gown", lengthBand: "floor", fitIntent: "relaxed" },
    { id: "abaya_flared", label: "Abaya — flared", key: "long_gown", lengthBand: "floor", fitIntent: "oversized" },
  ],
  ANARKALI: [
    { id: "anarkali", label: "Anarkali (flared)", key: "long_gown", lengthBand: "floor", fitIntent: "relaxed" },
    { id: "anarkali_calf", label: "Anarkali — mid calf", key: "long_gown", lengthBand: "below_knee", fitIntent: "relaxed" },
  ],
  KAFTAN: [
    { id: "kaftan", label: "Kaftan", key: "long_gown", lengthBand: "floor", fitIntent: "oversized" },
    { id: "kaftan_short", label: "Short kaftan", key: "long_gown", lengthBand: "knee", fitIntent: "oversized" },
  ],
  MAXI_DRESS: [
    { id: "maxi", label: "Maxi dress", key: "long_gown", lengthBand: "floor", fitIntent: "semi_fitted" },
    { id: "maxi_column", label: "Column maxi", key: "long_gown", lengthBand: "floor", fitIntent: "fitted" },
  ],
  FROCK: [
    { id: "frock_knee", label: "Frock — knee length", key: "long_gown", lengthBand: "knee", fitIntent: "relaxed" },
    { id: "frock_long", label: "Frock — mid calf", key: "long_gown", lengthBand: "below_knee", fitIntent: "relaxed" },
  ],
  PESHWAAS: [
    { id: "peshwaas", label: "Peshwaas", key: "long_gown", lengthBand: "floor", fitIntent: "relaxed" },
  ],

  // ---- Lower-body pieces --------------------------------------------------
  PANT: [
    { id: "straight_pant", label: "Straight pant", key: "trouser", lengthBand: "ankle", fitIntent: "semi_fitted" },
    { id: "slim_pant", label: "Slim pant", key: "trouser", lengthBand: "ankle", fitIntent: "fitted" },
    { id: "wide_pant", label: "Wide-leg pant", key: "trouser", lengthBand: "floor", fitIntent: "relaxed" },
  ],
  PALAZZO: [
    { id: "palazzo", label: "Palazzo (wide)", key: "trouser", lengthBand: "floor", fitIntent: "relaxed" },
    { id: "palazzo_ankle", label: "Palazzo — ankle", key: "trouser", lengthBand: "ankle", fitIntent: "relaxed" },
  ],
  SHALWAR: [
    { id: "shalwar", label: "Shalwar", key: "trouser", lengthBand: "ankle", fitIntent: "relaxed" },
    { id: "shalwar_slim", label: "Slim shalwar", key: "trouser", lengthBand: "ankle", fitIntent: "semi_fitted" },
  ],
  CAPRI: [
    { id: "capri", label: "Capri", key: "trouser", lengthBand: "below_knee", fitIntent: "fitted" },
  ],
  CULOTTE: [
    { id: "culotte", label: "Culotte", key: "trouser", lengthBand: "below_knee", fitIntent: "relaxed" },
  ],
  SHARARA: [
    { id: "sharara", label: "Sharara", key: "trouser", lengthBand: "floor", fitIntent: "oversized" },
  ],
  GHARARA: [
    { id: "gharara", label: "Gharara", key: "trouser", lengthBand: "floor", fitIntent: "oversized" },
  ],
  LEHENGA: [
    { id: "lehenga", label: "Lehenga (flared)", key: "long_gown", lengthBand: "floor", fitIntent: "oversized" },
    { id: "lehenga_slim", label: "Lehenga — slim", key: "long_gown", lengthBand: "floor", fitIntent: "semi_fitted" },
  ],

};

/**
 * Categories with no presets on purpose: unstitched yardage and flat drapes
 * (DUPATTA, SHAWL, SAREE, UNSTITCHED_*) have no body block to grade, and
 * CO_ORD_SET is sized through its component pieces rather than as one garment.
 */
export function stylesForCategory(pieceKey: string): StylePreset[] {
  return CATEGORY_STYLES[pieceKey.toUpperCase()] ?? [];
}

export function findStylePreset(
  pieceKey: string,
  styleId: string,
): StylePreset | undefined {
  return stylesForCategory(pieceKey).find((s) => s.id === styleId);
}
