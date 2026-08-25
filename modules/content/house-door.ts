import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

/** Resolve house-door tag keys used on design FREE tags. */
export function houseDoorTagKeys(categoryKey: string): string[] {
  const raw = categoryKey.trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  const house = HOUSE_COLLECTIONS.find(
    (c) => c.tag === upper || c.slug === lower,
  );
  if (!house) return [upper, lower];
  return [house.tag, house.slug, house.slug.toUpperCase()];
}
