/** Show scarcity copy on the storefront when available units are at or below this count. */
export const RTW_LOW_STOCK_THRESHOLD = 5;

/** Client-safe copy helper — no database imports. Stock is per colourway × size. */
export function rtwLowStockMessage(
  available: number,
  sizeLabel: string,
): string | null {
  if (available <= 0 || available > RTW_LOW_STOCK_THRESHOLD) return null;
  return rtwStockCapMessage(available, sizeLabel);
}

export function rtwStockCapMessage(available: number, sizeLabel: string): string {
  return available === 1
    ? `Size ${sizeLabel} — only 1 piece left.`
    : `Size ${sizeLabel} — only ${available} pieces left.`;
}

export function rtwSoldOutSizeMessage(sizeLabel: string): string {
  return `Size ${sizeLabel} is sold out.`;
}

export function rtwInsufficientStockMessage(
  available: number,
  sizeLabel: string,
): string {
  if (available <= 0) return rtwSoldOutSizeMessage(sizeLabel);
  return rtwStockCapMessage(available, sizeLabel);
}
