/** Integer hundredths of a metre → display string (e.g. 450 → "4.5 m"). */
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
    body = `${whole}`;
  } else if (frac % 10 === 0) {
    body = `${whole}.${frac / 10}`;
  } else {
    body = `${whole}.${frac.toString().padStart(2, "0")}`;
  }
  return `${negative ? "-" : ""}${body} m`;
}
