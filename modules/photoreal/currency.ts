export function getUsdPkrRate(): number {
  const n = Number(process.env.USD_PKR_RATE);
  return Number.isFinite(n) && n > 0 ? n : 278;
}

export function usdToPkr(usd: number): number {
  return Math.round(usd * getUsdPkrRate());
}

export function formatPkrFromUsd(usd: number): string {
  return `PKR ${usdToPkr(usd).toLocaleString("en-PK")}`;
}

/** Client-safe PKR formatting when the rate is already known from the server. */
export function formatPkrAtRate(usd: number, rate: number): string {
  return `PKR ${Math.round(usd * rate).toLocaleString("en-PK")}`;
}

export function usdToPkrAtRate(usd: number, rate: number): number {
  return Math.round(usd * rate);
}
