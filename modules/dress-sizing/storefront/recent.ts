export const RECENT_DESIGN_LIMIT = 5;
export function splitRecent<T extends { id: string; mtimeMs: number }>(items: T[], limit = RECENT_DESIGN_LIMIT) {
  const ranked = [...items].sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { keep: ranked.slice(0, limit), discard: ranked.slice(limit) };
}
