import type { FitIntent, GarmentType, LengthBand, PomKey } from "../db/enums";
import { inchesToHundredths } from "./units";
import type { StylePomSpec } from "./types";

export const HEM_LANDMARKS = ["hip", "mid_thigh", "above_knee", "knee", "mid_calf", "ankle", "floor"] as const;
export type HemLandmark = (typeof HEM_LANDMARKS)[number];
export const NECK_SHAPES = ["high", "round", "boat", "v", "keyhole", "deep_v"] as const;
export type NeckShape = (typeof NECK_SHAPES)[number];
export const NECK_DROPS = ["shallow", "regular", "deep"] as const;
export type NeckDrop = (typeof NECK_DROPS)[number];
export const SLEEVE_STYLES = ["sleeveless", "cap", "short", "elbow", "three_quarter", "full"] as const;
export type SleeveStyle = (typeof SLEEVE_STYLES)[number];
export const SHOULDER_WIDTHS = ["narrow", "regular", "wide"] as const;
export type ShoulderWidth = (typeof SHOULDER_WIDTHS)[number];
export const HEM_FULLNESS = ["slim", "regular", "flared"] as const;
export type HemFullness = (typeof HEM_FULLNESS)[number];
export type StylePoints = {
  hem?: { landmark?: HemLandmark; fullness?: HemFullness };
  neck?: { shape?: NeckShape; drop?: NeckDrop };
  sleeve?: { style?: SleeveStyle };
  chest?: { fit?: FitIntent };
  waist?: { fit?: FitIntent };
  hip?: { fit?: FitIntent };
  shoulder?: { width?: ShoulderWidth };
};

const FIT_EASE = mapLengths({ fitted: 2, semi_fitted: 4, relaxed: 7, oversized: 10 });
const DRESS_HEM = mapLengths({ hip: 24, mid_thigh: 28, above_knee: 31, knee: 38, mid_calf: 44, ankle: 51, floor: 57 });
const PANT_HEM = mapLengths({ hip: 24, mid_thigh: 28, above_knee: 28, knee: 34, mid_calf: 38, ankle: 42, floor: 44 });
const SLEEVE = mapLengths({ sleeveless: 0, cap: 5, short: 9, elbow: 14, three_quarter: 18, full: 22 });
const SHOULDER_EXTRA = mapLengths({ narrow: -0.5, regular: 0, wide: 1.5 });
const HEM_DELTA = mapLengths({ slim: -3, regular: 0, flared: 4 });
const NECK_SHAPE = mapLengths({ high: 1.5, round: 3, boat: 2.5, v: 4.5, keyhole: 4.5, deep_v: 6.5 });
const NECK_DELTA = mapLengths({ shallow: -1, regular: 0, deep: 2 });

function mapLengths<T extends string>(values: Record<T, number>): Record<T, number> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, inchesToHundredths(value as number)]),
  ) as Record<T, number>;
}
function alter(poms: StylePomSpec[], key: PomKey, field: "ease" | "baseValue", value: number, add = false) {
  return poms.map((pom) => pom.key === key
    ? { ...pom, [field]: add ? Math.max(0, (pom[field] ?? 0) + value) : value }
    : pom);
}

export function lengthBandFromLandmark(landmark: HemLandmark): LengthBand {
  if (landmark === "hip" || landmark === "mid_thigh" || landmark === "above_knee") {
    return "above_knee";
  }
  if (landmark === "knee") return "knee";
  if (landmark === "mid_calf") return "below_knee";
  return landmark;
}
export function lengthHundredthsFromLandmark(type: GarmentType, landmark: HemLandmark) {
  return type === "trouser" ? PANT_HEM[landmark] : DRESS_HEM[landmark];
}
export function neckDropHundredths(shape?: NeckShape, drop?: NeckDrop): number | null {
  if (!shape && !drop) return null;
  return Math.max(inchesToHundredths(1), NECK_SHAPE[shape ?? "round"] + NECK_DELTA[drop ?? "regular"]);
}
export function applyStylePoints(poms: StylePomSpec[], type: GarmentType, points?: StylePoints) {
  if (!points) return poms;
  let next = poms;
  if (points.chest?.fit) next = alter(next, "chest", "ease", FIT_EASE[points.chest.fit]);
  if (points.waist?.fit) next = alter(next, "waist", "ease", FIT_EASE[points.waist.fit]);
  if (points.hip?.fit) next = alter(next, "hip", "ease", FIT_EASE[points.hip.fit]);
  if (points.shoulder?.width) next = alter(next, "shoulder", "ease", SHOULDER_EXTRA[points.shoulder.width], true);
  if (points.hem?.landmark) next = alter(next, "garmentLength", "baseValue", lengthHundredthsFromLandmark(type, points.hem.landmark));
  if (points.hem?.fullness) next = alter(next, "hemWidth", "baseValue", HEM_DELTA[points.hem.fullness], true);
  if (points.sleeve?.style) next = alter(next, "sleeveLength", "baseValue", SLEEVE[points.sleeve.style]);
  const neck = neckDropHundredths(points.neck?.shape, points.neck?.drop);
  return neck === null ? next : alter(next, "neckDrop", "baseValue", neck);
}
export function resolvedLengthBand(lengthBand: LengthBand, points?: StylePoints): LengthBand {
  return points?.hem?.landmark ? lengthBandFromLandmark(points.hem.landmark) : lengthBand;
}
