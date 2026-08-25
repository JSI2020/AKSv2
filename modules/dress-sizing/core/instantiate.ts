import type { FitIntent, GarmentType, LengthBand, PomKey } from "../db/enums";
import { DEFAULT_BASE_SIZE } from "../db/enums";
import { inchesToHundredths } from "./units";
import type { InstantiatedStyle, StylePomSpec } from "./types";
import { applyStylePoints, resolvedLengthBand, type StylePoints } from "./style-points";

export const FIT_INTENT_EASE_HUNDREDTHS: Record<FitIntent, number> = {
  fitted: inchesToHundredths(2),
  semi_fitted: inchesToHundredths(4),
  relaxed: inchesToHundredths(7),
  oversized: inchesToHundredths(10),
};
export const SHOULDER_EXTRA_HUNDREDTHS: Record<FitIntent, number> = {
  fitted: 0,
  semi_fitted: 0,
  relaxed: inchesToHundredths(0.5),
  oversized: inchesToHundredths(4),
};
export const DRESS_LENGTH_BAND_HUNDREDTHS: Record<LengthBand, number> = {
  above_knee: 3100, knee: 3800, below_knee: 4400, ankle: 5100, floor: 5700,
};
export const PANT_LENGTH_BAND_HUNDREDTHS: Record<LengthBand, number> = {
  above_knee: 2800, knee: 3400, below_knee: 3800, ankle: 4200, floor: 4400,
};
const GIRTH_FIT_KEYS: PomKey[] = ["chest", "waist"];

export function lengthHundredthsFor(type: GarmentType, band: LengthBand): number {
  return type === "trouser"
    ? PANT_LENGTH_BAND_HUNDREDTHS[band]
    : DRESS_LENGTH_BAND_HUNDREDTHS[band];
}
export function lengthGradeHundredthsFor(type: GarmentType): number {
  return inchesToHundredths(type === "trouser" ? 0.5 : 1);
}
export type TemplateInput = {
  key: InstantiatedStyle["templateKey"];
  category: InstantiatedStyle["category"];
  baseSize?: InstantiatedStyle["baseSize"];
  poms: StylePomSpec[];
  fitWeights: InstantiatedStyle["fitWeights"];
};
export function instantiateStyle(
  template: TemplateInput,
  options: { lengthBand: LengthBand; fitIntent: FitIntent; name?: string; points?: StylePoints },
): InstantiatedStyle {
  const band = resolvedLengthBand(options.lengthBand, options.points);
  const mapped = template.poms.map((pom) => {
    if (GIRTH_FIT_KEYS.includes(pom.key)) return { ...pom, ease: FIT_INTENT_EASE_HUNDREDTHS[options.fitIntent] };
    if (pom.key === "shoulder") return { ...pom, ease: (pom.ease ?? 0) + SHOULDER_EXTRA_HUNDREDTHS[options.fitIntent] };
    if (pom.key === "garmentLength") return {
      ...pom,
      baseValue: lengthHundredthsFor(template.key, band),
      gradeIncrement: lengthGradeHundredthsFor(template.key),
    };
    return { ...pom };
  });
  return {
    name: options.name ?? "Design",
    templateKey: template.key,
    category: template.category,
    baseSize: template.baseSize ?? DEFAULT_BASE_SIZE,
    lengthBand: band,
    fitIntent: options.fitIntent,
    poms: applyStylePoints(mapped, template.key, options.points),
    fitWeights: template.fitWeights.map((weight) => ({ ...weight })),
  };
}
