/**
 * House standard blocks — finished-garment measurements at base size M.
 *
 * Blocked from the two researched references rather than invented: the kameez
 * block (bust 40.0, waist 39.5, hip 43.0, shoulder 14.5, sleeve 22.5, length
 * 37.0, sweep 47.0) for anything hanging from the shoulders, and the pant block
 * (waist 32.0, hip 38.0, length 38.0) for anything worn from the waist down.
 *
 * Lengths are anchored to the house body: a 64" figure carries its shoulder
 * about 52" above the floor, so floor-length reads ~54", ankle ~51, mid-calf
 * ~46, knee ~40.
 *
 * Values are inches; the loader converts to hundredths.
 */

export type HouseStandardSpec = {
  /** measurementKey → finished measurement at M, inches */
  base: Record<string, number>;
  note: string;
};

/**
 * A real block does not grade every row by the same amount — that uniformity is
 * exactly what marks the seed filler. Girths move a full size step; a shoulder
 * seam barely moves; a neckline hardly at all.
 */
export const HOUSE_GRADE_BY_KEY: Record<string, number> = {
  BUST: 2,
  CHEST: 2,
  WAIST: 2,
  UPPER_WAIST: 2,
  LOWER_WAIST: 2,
  BOTTOM_WAIST: 2,
  HIP: 2,
  BOTTOM_HIP: 2,
  TOP_HIP: 2,
  SWEEP: 2,
  DAMAN: 2,
  BOTTOM_OPENING: 0.5,
  SLEEVE_OPENING: 0.5,
  THIGH: 1,
  KNEE: 0.5,
  SHOULDER: 0.5,
  CROSS_BACK: 0.5,
  ARMHOLE: 0.5,
  SLEEVE_LENGTH: 0.25,
  LENGTH: 0.5,
  TOP_LENGTH: 0.5,
  BOTTOM_LENGTH: 0.5,
  BOTTOM_RISE: 0.25,
  NECK_DEPTH_FRONT: 0.13,
  NECK_DEPTH_BACK: 0.13,
  WIDTH: 0,
};

/** Shared upper-body detail, from the researched kameez block. */
const UPPER_DETAIL = {
  SHOULDER: 14.5,
  SLEEVE_LENGTH: 22.5,
  SLEEVE_OPENING: 12,
  ARMHOLE: 10,
  NECK_DEPTH_FRONT: 7,
  NECK_DEPTH_BACK: 3,
  CROSS_BACK: 14.5,
};

const upper = (
  bust: number,
  waist: number,
  hip: number,
  length: number,
  sweep: number,
  note: string,
  overrides: Record<string, number> = {},
): HouseStandardSpec => ({
  base: {
    BUST: bust,
    CHEST: bust,
    WAIST: waist,
    UPPER_WAIST: waist,
    HIP: hip,
    LENGTH: length,
    SWEEP: sweep,
    DAMAN: sweep,
    ...UPPER_DETAIL,
    ...overrides,
  },
  note,
});

const lower = (
  waist: number,
  hip: number,
  length: number,
  opening: number,
  note: string,
): HouseStandardSpec => ({
  base: {
    WAIST: waist,
    LOWER_WAIST: waist,
    BOTTOM_WAIST: waist,
    HIP: hip,
    BOTTOM_HIP: hip,
    LENGTH: length,
    BOTTOM_LENGTH: length,
    BOTTOM_OPENING: opening,
    BOTTOM_RISE: 11,
    THIGH: Math.round(hip * 0.62),
    KNEE: Math.max(14, Math.round(opening * 1.1)),
  },
  note,
});

export const HOUSE_STANDARD_BLOCKS: Record<string, HouseStandardSpec> = {
  // ---- Upper body ---------------------------------------------------------
  KURTA: upper(40, 39.5, 43, 40, 47, "Knee-length kurta, semi-fitted."),
  SHIRT: upper(40, 39.5, 43, 30, 44, "Short shirt, above the knee."),
  STRAIGHT_SHIRT: upper(40, 40, 43, 38, 43, "Straight cut — sweep equals hip."),
  A_LINE_SHIRT: upper(40, 40, 43, 38, 52, "Flares from the waist to the hem."),
  ANGRAKHA: upper(40, 38, 43, 40, 50, "Fitted through the waist, wrapped front."),
  BLOUSE_CHOLI: upper(36, 30, 34, 15, 34, "Fitted and cropped.", {
    SLEEVE_LENGTH: 9,
    ARMHOLE: 8.5,
  }),
  WAISTCOAT: upper(41, 40, 43, 32, 45, "Worn over — no sleeve.", {
    SLEEVE_LENGTH: 0,
    SLEEVE_OPENING: 0,
  }),
  JACKET: upper(42, 42, 44, 28, 46, "Worn over a kurta."),
  CAPE: upper(42, 42, 44, 32, 60, "No side seam or armhole.", {
    SLEEVE_LENGTH: 0,
    SLEEVE_OPENING: 0,
    ARMHOLE: 0,
  }),

  // ---- Full length --------------------------------------------------------
  ABAYA: upper(44, 44, 46, 54, 60, "Column to the floor.", {
    SLEEVE_LENGTH: 23,
  }),
  ANARKALI: upper(40, 38, 44, 52, 90, "Heavily flared from the empire seam."),
  KAFTAN: upper(50, 50, 50, 54, 60, "One tube, oversized.", {
    SLEEVE_LENGTH: 20,
    SLEEVE_OPENING: 18,
  }),
  MAXI_DRESS: upper(40, 38, 43, 54, 55, "Floor length, softly shaped."),
  FROCK: upper(40, 38, 44, 40, 60, "Flared, knee length."),
  PESHWAAS: upper(42, 40, 46, 52, 80, "Flared to the floor."),
  GOWN: upper(40, 36, 42, 54, 55, "Fitted through the body, floor length."),

  // ---- Lower body ---------------------------------------------------------
  TROUSER: lower(32, 38, 38, 14, "Straight trouser to the ankle."),
  SHALWAR: lower(40, 46, 38, 16, "Gathered at the waist, tapered to the ankle."),
  CULOTTE: lower(32, 40, 28, 24, "Wide, below the knee."),
  CAPRI: lower(32, 38, 30, 12, "Narrow, below the knee."),
  SHARARA: lower(32, 40, 40, 40, "Flared from the knee."),
  GHARARA: lower(32, 40, 40, 45, "Gathered at the knee, flared below."),
  SKIRT: lower(30, 40, 38, 45, "A-line to mid calf."),

  // ---- Drapes (one size, no grading) --------------------------------------
  DUPATTA: { base: { LENGTH: 90, WIDTH: 40 }, note: "Standard dupatta cut." },
  SHAWL: { base: { LENGTH: 80, WIDTH: 30 }, note: "Standard shawl cut." },
};
