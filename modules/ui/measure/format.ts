/**
 * Measure: integer hundredths of an inch. NEVER floats at the boundary.
 * Renders with the inch prime (″), trimming trailing zeros.
 */
export function formatMeasure(
  value: number,
  unit: "in" = "in",
): string {
  if (!Number.isInteger(value)) {
    throw new TypeError("Measure value must be an integer (hundredths)");
  }

  const negative = value < 0;
  const abs = Math.abs(value);

  // Round half-away-from-zero at the hundredths already stored as int;
  // if callers pass a wider scale later, clamp display rounding here.
  const rounded = abs;

  const whole = Math.trunc(rounded / 100);
  const frac = rounded % 100;

  let body: string;
  if (frac === 0) {
    body = `${whole}`;
  } else if (frac % 10 === 0) {
    body = `${whole}.${frac / 10}`;
  } else {
    body = `${whole}.${frac.toString().padStart(2, "0")}`;
  }

  const suffix = unit === "in" ? "″" : unit;
  return `${negative ? "-" : ""}${body}${suffix}`;
}
