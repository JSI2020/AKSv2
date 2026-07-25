/** Auto-name pattern: `{CATEGORY}-{YEAR}-{SEQ}` e.g. KAMEEZ-2026-014 */

const NAME_PATTERN = /^([A-Z0-9_]+)-(\d{4})-(\d{3,})$/;

export function formatDesignBriefName(
  categoryKey: string,
  year: number,
  seq: number,
): string {
  const key = categoryKey.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const padded = String(seq).padStart(3, "0");
  return `${key}-${year}-${padded}`;
}

export function parseDesignBriefName(name: string): {
  categoryKey: string;
  year: number;
  seq: number;
} | null {
  const match = NAME_PATTERN.exec(name.trim());
  if (!match) return null;
  return {
    categoryKey: match[1]!,
    year: Number.parseInt(match[2]!, 10),
    seq: Number.parseInt(match[3]!, 10),
  };
}

/** Next sequence for `{categoryKey}-{year}-###` from existing design names. */
export function nextDesignBriefSeq(
  existingNames: readonly string[],
  categoryKey: string,
  year: number,
): number {
  const prefix = `${categoryKey.toUpperCase()}-${year}-`;
  let max = 0;
  for (const name of existingNames) {
    const parsed = parseDesignBriefName(name);
    if (
      parsed &&
      parsed.categoryKey === categoryKey.toUpperCase() &&
      parsed.year === year &&
      parsed.seq > max
    ) {
      max = parsed.seq;
    }
    if (name.startsWith(prefix)) {
      const tail = name.slice(prefix.length);
      const n = Number.parseInt(tail, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}
