/**
 * Measure: integer hundredths of an inch at the storage boundary. NEVER floats there.
 * Display may convert to centimetres (display-only).
 */
export function formatMeasure(
  value: number,
  unit: "in" | "cm" = "in",
): string {
  if (!Number.isInteger(value)) {
    throw new TypeError("Measure value must be an integer (hundredths)");
  }

  if (unit === "cm") {
    // hundredths of inch → tenths of cm: (value/100)*2.54*10 = value*254/1000
    const cmScaled = Math.round((value * 254) / 1000);
    const negative = cmScaled < 0;
    const abs = Math.abs(cmScaled);
    const whole = Math.trunc(abs / 10);
    const tenths = abs % 10;
    const body = tenths === 0 ? `${whole}` : `${whole}.${tenths}`;
    return `${negative ? "-" : ""}${body} cm`;
  }

  const negative = value < 0;
  const abs = Math.abs(value);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;

  let body: string;
  if (frac === 0) {
    body = `${whole}`;
  } else if (frac % 10 === 0) {
    body = `${whole}.${frac / 10}`;
  } else {
    body = `${whole}.${frac.toString().padStart(2, "0")}`;
  }

  return `${negative ? "-" : ""}${body}″`;
}

/** Parse a user-typed inch or cm string into hundredths of an inch. */
export function parseMeasureInput(
  raw: string,
  unit: "in" | "cm",
): number | null {
  const trimmed = raw.trim().replace(/[″"cmCM\s]/g, "");
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (unit === "cm") {
    // cm → hundredths of inch: n / 2.54 * 100 = n * 10000 / 254
    return Math.round((n * 10000) / 254);
  }
  return Math.round(n * 100);
}
