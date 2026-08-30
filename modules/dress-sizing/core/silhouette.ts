import type { FitIntent, GarmentType, PomKey } from "../db/enums";
import { inchesToHundredths } from "./units";
import type { HemFullness, StylePoints } from "./style-points";
import type { GeneratedRow } from "./types";

/** How finished girths relate across the body block. */
export type SilhouetteMode = "waisted" | "column" | "a_line";

const FIT_RANK: Record<FitIntent, number> = {
  fitted: 0,
  semi_fitted: 1,
  relaxed: 2,
  oversized: 3,
};

const GIRTH_KEYS: PomKey[] = ["chest", "waist", "hip"];

const FLARE_ABOVE_GIRTH_HUNDREDTHS = inchesToHundredths(4);
const SLIM_BELOW_GIRTH_HUNDREDTHS = inchesToHundredths(2);

export const SILHOUETTE_LABELS: Record<SilhouetteMode, string> = {
  waisted: "Waisted — chest and waist grade separately",
  column: "Column — same circumference block to block",
  a_line: "A-line — hem wider than body block",
};

/**
 * Designer rule: column/abaya/maxi cuts share one wearing circumference.
 * Waisted kameez/kurti cuts follow body bust vs waist separately.
 */
export function resolveSilhouette(input: {
  templateKey: GarmentType;
  fitIntent: FitIntent;
  points?: StylePoints;
}): SilhouetteMode {
  const { templateKey, fitIntent, points } = input;
  const chestFit = points?.chest?.fit ?? fitIntent;
  const waistFit = points?.waist?.fit ?? fitIntent;
  const fullness = points?.hem?.fullness;

  if (fullness === "flared") return "a_line";

  if (templateKey === "trouser") return "waisted";

  if (templateKey === "long_gown" && fitIntent !== "fitted") return "column";

  if (fitIntent === "relaxed" || fitIntent === "oversized") return "column";

  if (FIT_RANK[waistFit] >= FIT_RANK.relaxed) return "column";

  if (FIT_RANK[waistFit] > FIT_RANK[chestFit]) return "column";

  if (templateKey === "vest_palazzo") return "column";

  return "waisted";
}

function rowsForSize(rows: GeneratedRow[], size: GeneratedRow["size"]) {
  return rows.filter((r) => r.size === size);
}

function setPom(
  rows: GeneratedRow[],
  size: GeneratedRow["size"],
  key: PomKey,
  valueHundredths: number,
): GeneratedRow[] {
  let found = false;
  const next = rows.map((r) => {
    if (r.size !== size || r.pomKey !== key) return r;
    found = true;
    return { ...r, valueHundredths: Math.round(valueHundredths) };
  });
  if (!found) {
    next.push({ size, pomKey: key, valueHundredths: Math.round(valueHundredths) });
  }
  return next;
}

function girthAt(rows: GeneratedRow[], size: GeneratedRow["size"], key: PomKey) {
  return rows.find((r) => r.size === size && r.pomKey === key)?.valueHundredths;
}

/**
 * Enforce wearable geometry on composed charts:
 * - Column: chest = waist = hip (one tube)
 * - A-line: hem sweep ≥ body block + flare
 * - Waisted: hem still cannot be narrower than waist (can't pass thighs)
 */
export function reconcileSilhouette(
  rows: GeneratedRow[],
  input: {
    silhouette: SilhouetteMode;
    hemFullness?: HemFullness;
    templateKey: GarmentType;
  },
): GeneratedRow[] {
  const { silhouette, hemFullness = "regular", templateKey } = input;
  let next = [...rows];

  const sizes = [...new Set(next.map((r) => r.size))];

  for (const size of sizes) {
    const sizeRows = rowsForSize(next, size);
    const chest = girthAt(sizeRows, size, "chest");
    const waist = girthAt(sizeRows, size, "waist");
    const hip = girthAt(sizeRows, size, "hip");

    let blockGirth = Math.max(chest ?? 0, waist ?? 0, hip ?? 0);

    if (silhouette === "column" || silhouette === "a_line") {
      if (blockGirth <= 0) continue;
      for (const key of GIRTH_KEYS) {
        if (girthAt(sizeRows, size, key) != null) {
          next = setPom(next, size, key, blockGirth);
        }
      }
    } else if (chest != null && waist != null && waist > chest) {
      // Waisted but numerically inverted — waist cannot exceed chest on upper block.
      next = setPom(next, size, "waist", chest);
      blockGirth = Math.max(chest, hip ?? 0);
    } else {
      blockGirth = Math.max(chest ?? 0, waist ?? 0, hip ?? 0);
    }

    const hem = girthAt(sizeRows, size, "hemWidth");
    if (hem == null || blockGirth <= 0) continue;

    let minHem = blockGirth;
    if (silhouette === "a_line" || hemFullness === "flared") {
      minHem = blockGirth + FLARE_ABOVE_GIRTH_HUNDREDTHS;
    } else if (
      hemFullness === "slim" &&
      silhouette === "waisted" &&
      templateKey !== "trouser"
    ) {
      minHem = Math.max(blockGirth - SLIM_BELOW_GIRTH_HUNDREDTHS, waist ?? 0);
    }

    if (hem < minHem) {
      next = setPom(next, size, "hemWidth", minHem);
    }
  }

  return next;
}

export function girthKeysEqualAtM(
  rows: GeneratedRow[],
  toleranceHundredths = 25,
): boolean {
  const m = rows.filter((r) => r.size === "M");
  const chest = m.find((r) => r.pomKey === "chest")?.valueHundredths;
  const waist = m.find((r) => r.pomKey === "waist")?.valueHundredths;
  if (chest == null || waist == null) return false;
  return Math.abs(chest - waist) <= toleranceHundredths;
}
