import type { FitIntent, LengthBand, PomKey, StandardSize } from "../db/enums";
import { POM_KEYS } from "../db/enums";
import { STYLE_TEMPLATE_SEEDS } from "../db/template-seeds";
import { aksStandardV1RowsHundredths } from "./body-grid";
import { bodyGridFromRows, composeChart } from "./compose";
import { instantiateStyle } from "./instantiate";
import type { BodyMeasurements, GeneratedRow, StylePomSpec } from "./types";

export const STANDARD_LENGTH_BAND: LengthBand = "knee";
export const STANDARD_FIT_INTENT: FitIntent = "semi_fitted";
export const STANDARD_TEMPLATE_KEY = "kurti" as const;

export function applyBaseSizeEdits(
  poms: StylePomSpec[],
  bodyM: BodyMeasurements,
  editsHundredths: Partial<Record<PomKey, number>>,
): StylePomSpec[] {
  return poms.map((pom) => {
    const next = editsHundredths[pom.key];
    if (next == null || Number.isNaN(next)) return { ...pom };
    if (pom.kind === "girth" && pom.derivedFrom !== null) {
      return { ...pom, ease: next - bodyM[pom.derivedFrom] };
    }
    return { ...pom, baseValue: next };
  });
}
export function measurementsAtSize(rows: GeneratedRow[], size: StandardSize) {
  const out: Partial<Record<PomKey, number>> = {};
  for (const row of rows) if (row.size === size) out[row.pomKey] = row.valueHundredths;
  return out;
}
export function standardGarmentRows(): GeneratedRow[] {
  const template = STYLE_TEMPLATE_SEEDS.find((seed) => seed.key === STANDARD_TEMPLATE_KEY);
  if (!template) throw new Error("Standard template is missing");
  const style = instantiateStyle(template, { lengthBand: STANDARD_LENGTH_BAND, fitIntent: STANDARD_FIT_INTENT });
  return composeChart(bodyGridFromRows(aksStandardV1RowsHundredths()), style);
}
export type VsStandard = {
  pomKey: PomKey;
  standardHundredths: number;
  styleHundredths: number;
  deltaHundredths: number;
};
export function vsStandard(styleRows: GeneratedRow[], size: StandardSize = "M"): VsStandard[] {
  const normal = measurementsAtSize(standardGarmentRows(), size);
  const current = measurementsAtSize(styleRows, size);
  return POM_KEYS.flatMap((pomKey) => {
    const standardHundredths = normal[pomKey];
    const styleHundredths = current[pomKey];
    return standardHundredths == null || styleHundredths == null ? [] : [{
      pomKey, standardHundredths, styleHundredths,
      deltaHundredths: styleHundredths - standardHundredths,
    }];
  });
}
