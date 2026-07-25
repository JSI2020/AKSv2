/** PKR paisa per 1 USD — override via AKS_USD_PKR_PAISA (default 28000 = Rs 280). */
export function usdToPkrPaisa(): number {
  const raw = process.env.AKS_USD_PKR_PAISA?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 28_000;
}

/** Convert USD micro-dollars to PKR paisa (integer, never floats). */
export function usdMicrosToPkrPaisa(usdMicros: number): number {
  if (!Number.isInteger(usdMicros) || usdMicros <= 0) return 0;
  return Math.round((usdMicros * usdToPkrPaisa()) / 1_000_000);
}
