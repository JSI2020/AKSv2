/**
 * Metres: integer hundredths of a metre at the storage boundary. NEVER floats there.
 */
export function formatMetres(hundredths: number): string {
  if (!Number.isInteger(hundredths)) {
    throw new TypeError("Metres value must be integer hundredths");
  }
  const negative = hundredths < 0;
  const abs = Math.abs(hundredths);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  let body: string;
  if (frac === 0) {
    body = `${whole}.0`;
  } else if (frac % 10 === 0) {
    body = `${whole}.${frac / 10}`;
  } else {
    body = `${whole}.${frac.toString().padStart(2, "0")}`;
  }
  return `${negative ? "-" : ""}${body} m`;
}

/** Parse a user-typed metre string into hundredths. */
export function parseMetresInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/[mM\s]/g, "");
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
