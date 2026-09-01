/** Phone / WhatsApp helpers for customer CRM — pure, no I/O. */

export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Display masking for admin tables: keep country + last hints light. */
export function maskPhone(raw: string | null | undefined): string {
  const d = normalizePhoneDigits(raw ?? "");
  if (d.length < 10) return raw?.trim() || "—";
  const tail = d.slice(-4);
  if (d.startsWith("92") && d.length >= 12) {
    return `+92 3•• ••• ${tail}`;
  }
  return `••• ••• ${tail}`;
}

export function formatWhatsAppHref(raw: string | null | undefined): string | null {
  const d = normalizePhoneDigits(raw ?? "");
  if (d.length < 10) return null;
  return `https://wa.me/${d}`;
}

/** Hamming distance on equal-length digit strings; else Infinity. */
export function phoneHammingDistance(a: string, b: string): number {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db || da.length !== db.length) return Number.POSITIVE_INFINITY;
  let diff = 0;
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) diff++;
  }
  return diff;
}

/** Exact or one-digit-off match (same length). */
export function isPhoneCloseMatch(typed: string, candidate: string): boolean {
  const d = normalizePhoneDigits(typed);
  const c = normalizePhoneDigits(candidate);
  if (d.length < 10 || c.length < 10) return false;
  if (d === c) return true;
  return phoneHammingDistance(d, c) === 1;
}

export function crmPlaceholderEmail(digits: string): string {
  const d = normalizePhoneDigits(digits);
  return `${d}@customers.aks.local`;
}

/**
 * Best-effort Pakistani MSISDN for the WhatsApp Cloud API: country code, no
 * plus, no leading zero. `03001234567` and `3001234567` both become
 * `923001234567`; an already-prefixed `92…` is left as-is.
 */
export function toWhatsappMsisdn(raw: string | null | undefined): string {
  const d = normalizePhoneDigits(raw ?? "");
  if (!d) return "";
  if (d.startsWith("92")) return d;
  if (d.startsWith("0")) return `92${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("3")) return `92${d}`;
  return d;
}

export function initialsFromName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
