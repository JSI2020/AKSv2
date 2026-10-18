/** Asia/Karachi is UTC+5 all year. Discount windows are entered and shown in PKT. */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function formatPktDatetimeLocal(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pkt = new Date(date.getTime() + PKT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pkt.getUTCFullYear()}-${pad(pkt.getUTCMonth() + 1)}-${pad(pkt.getUTCDate())}T${pad(pkt.getUTCHours())}:${pad(pkt.getUTCMinutes())}`;
}

/** `YYYY-MM-DDTHH:mm` from a datetime-local input, read as PKT. */
export function parsePktDatetimeLocal(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}:${match[3] ?? "00"}+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
