export const HUNDREDTHS_PER_INCH = 100;
export const MM_PER_INCH = 25.4;
export type DisplayUnit = "in" | "cm";

export function inchesToHundredths(inches: number): number {
  return Math.round(inches * HUNDREDTHS_PER_INCH);
}

export function hundredthsToInches(valueHundredths: number): number {
  return valueHundredths / HUNDREDTHS_PER_INCH;
}

export function mmToHundredths(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * HUNDREDTHS_PER_INCH);
}

export function hundredthsToMm(valueHundredths: number): number {
  return (valueHundredths / HUNDREDTHS_PER_INCH) * MM_PER_INCH;
}

export function cmToHundredths(cm: number): number {
  return mmToHundredths(cm * 10);
}

export function hundredthsToCm(valueHundredths: number): number {
  return hundredthsToMm(valueHundredths) / 10;
}

export function roundToQuarterInch(inches: number): number {
  return Math.round(inches * 4) / 4;
}

export function hundredthsToDisplayNumber(
  valueHundredths: number,
  unit: DisplayUnit,
): number {
  if (unit === "cm") return Math.round(hundredthsToCm(valueHundredths) * 10) / 10;
  return roundToQuarterInch(hundredthsToInches(valueHundredths));
}

export function displayNumberToHundredths(
  value: number,
  unit: DisplayUnit,
): number {
  return unit === "cm" ? cmToHundredths(value) : inchesToHundredths(value);
}

export function formatLength(
  valueHundredths: number,
  unit: DisplayUnit = "in",
): string {
  const value = hundredthsToDisplayNumber(valueHundredths, unit);
  const body = Number.isInteger(value) ? String(value) : String(value);
  return `${body} ${unit}`;
}
