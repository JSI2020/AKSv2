import { asc, eq } from "drizzle-orm";

import { db, houseCollections } from "@aks/db";

import {
  DEFAULT_HOUSE_COLLECTIONS,
  getHouseCollectionBySlugSync,
} from "./house-collections";

export type HouseCollectionRow = typeof houseCollections.$inferSelect;

export type HouseCollectionPublic = {
  id: string;
  tag: string;
  slug: string;
  itemCode: string;
  navLabel: string;
  title: string;
  tagline: string;
  card: string;
  intro: string;
  sortOrder: number;
  active: boolean;
};

function toPublic(row: HouseCollectionRow): HouseCollectionPublic {
  return {
    id: row.id,
    tag: row.tag,
    slug: row.slug,
    itemCode: row.itemCode,
    navLabel: row.navLabel,
    title: row.title,
    tagline: row.tagline,
    card: row.card,
    intro: row.intro,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

function seedToPublic(
  seed: (typeof DEFAULT_HOUSE_COLLECTIONS)[number],
): HouseCollectionPublic {
  return {
    id: `seed-${seed.slug}`,
    tag: seed.tag,
    slug: seed.slug,
    itemCode: seed.itemCode,
    navLabel: seed.navLabel,
    title: seed.title,
    tagline: seed.tagline,
    card: seed.card,
    intro: seed.intro,
    sortOrder: seed.sortOrder,
    active: true,
  };
}

/** DB miss — fall back to seeded defaults (dev / unseeded DB). */
export function resolveHouseCollectionBySlug(
  slug: string,
): HouseCollectionPublic | null {
  const seed = getHouseCollectionBySlugSync(slug);
  return seed ? seedToPublic(seed) : null;
}

export async function listHouseCollections(input?: {
  activeOnly?: boolean;
}): Promise<HouseCollectionPublic[]> {
  const query = db
    .select()
    .from(houseCollections)
    .orderBy(asc(houseCollections.sortOrder), asc(houseCollections.title));
  const rows = input?.activeOnly
    ? await query.where(eq(houseCollections.active, true))
    : await query;
  if (rows.length > 0) {
    return rows.map(toPublic);
  }
  return DEFAULT_HOUSE_COLLECTIONS.map(seedToPublic);
}

export async function getHouseCollectionById(
  id: string,
): Promise<HouseCollectionPublic | null> {
  const [row] = await db
    .select()
    .from(houseCollections)
    .where(eq(houseCollections.id, id))
    .limit(1);
  return row ? toPublic(row) : null;
}

export async function getHouseCollectionBySlug(
  slug: string,
): Promise<HouseCollectionPublic | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "white" || normalized === "white-collection") {
    return getHouseCollectionBySlug("signature");
  }
  const [row] = await db
    .select()
    .from(houseCollections)
    .where(eq(houseCollections.slug, normalized))
    .limit(1);
  return row ? toPublic(row) : resolveHouseCollectionBySlug(normalized);
}

export async function getHouseCollectionByTag(
  tag: string,
): Promise<HouseCollectionPublic | null> {
  const upper = tag.trim().toUpperCase();
  if (!upper) return null;
  const [row] = await db
    .select()
    .from(houseCollections)
    .where(eq(houseCollections.tag, upper))
    .limit(1);
  return row ? toPublic(row) : null;
}

export async function countHouseCollections(): Promise<number> {
  const rows = await db.select({ id: houseCollections.id }).from(houseCollections);
  return rows.length;
}
