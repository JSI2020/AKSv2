import type { PomKey, StandardSize } from "../db/enums";
import type { DisplayUnit } from "../core/units";
import { displayNumberToHundredths, hundredthsToDisplayNumber } from "../core/units";

export const HALF_POMS: PomKey[] = ["chest", "waist", "hip"];
export type ChartSpan = "full" | "half";
export const cellKey = (pomKey: PomKey, size: StandardSize) => `${pomKey}:${size}`;
export function cellInputValue(value: number, key: PomKey, span: ChartSpan, unit: DisplayUnit) {
  const shown = span === "half" && HALF_POMS.includes(key) ? value / 2 : value;
  return String(hundredthsToDisplayNumber(shown, unit));
}
export function storedHundredthsFromDisplay(value: number, key: PomKey, span: ChartSpan, unit: DisplayUnit) {
  const stored = displayNumberToHundredths(value, unit);
  return span === "half" && HALF_POMS.includes(key) ? stored * 2 : stored;
}
