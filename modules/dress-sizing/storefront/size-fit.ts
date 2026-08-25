import type { FitIntent, LengthBand, PomKey, StandardSize } from "../db/enums";
import { SIZE_INDEX, STANDARD_SIZES } from "../db/enums";
import { hundredthsToDisplayNumber } from "../core/units";
import { POM_LABELS } from "../ui/labels";

export const MINI_TABLE_POMS: PomKey[] = ["shoulder", "chest", "waist", "garmentLength", "sleeveLength"];
export function snippetSizes(base: StandardSize): StandardSize[] {
  const i = SIZE_INDEX[base];
  if (i <= 0) return ["XS", "S", "M"];
  if (i >= 5) return ["L", "XL", "XXL"];
  return [STANDARD_SIZES[i - 1]!, base, STANDARD_SIZES[i + 1]!];
}
export const inchCell = (value?: number) => value == null ? "—" : String(hundredthsToDisplayNumber(value, "in"));
export const miniPomLabel = (key: PomKey) => POM_LABELS[key];
export function sizeFitBlurb(fit: FitIntent, length: LengthBand, base: StandardSize) {
  return `${fit.replace("_", " ")} · ${length.replace("_", " ")} · sample ${base}`;
}
