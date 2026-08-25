/** Shared packing/trim create helpers — not a "use server" module. */

export const TRIM_KINDS = [
  "BUTTON",
  "ZIP",
  "LINING",
  "HOOK",
  "THREAD",
  "OTHER",
] as const;

export type TrimKind = (typeof TRIM_KINDS)[number];

export function parseNonNegInt(raw: unknown): number | null {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/** PKR rupees (whole) → paisa. */
export function pkrToPaisa(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return 0;
  const n = Number.parseInt(s, 10);
  if (!Number.isInteger(n) || n < 0) return null;
  return n * 100;
}
