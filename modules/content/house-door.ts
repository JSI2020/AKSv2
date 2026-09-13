import { getHouseCollectionByTag } from "@/modules/catalog/house-collections-queries";

/** Resolve house-door tag keys used on design FREE tags. */
export async function houseDoorTagKeys(
  categoryKey: string,
): Promise<string[]> {
  const raw = categoryKey.trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  const house = await getHouseCollectionByTag(upper);
  if (house) return [house.tag, house.slug, house.slug.toUpperCase()];
  const bySlug = await import("@/modules/catalog/house-collections-queries").then(
    (m) => m.getHouseCollectionBySlug(lower),
  );
  if (bySlug) return [bySlug.tag, bySlug.slug, bySlug.slug.toUpperCase()];
  return [upper, lower];
}
