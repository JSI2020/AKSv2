import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db, designTags, designs } from "@aks/db";

import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

import { houseDoorTagKeys } from "./house-door";
import type { PublishedDesignOption } from "./types";

export type { PublishedDesignOption };
export { houseDoorTagKeys };

export async function listPublishedDesignOptions(): Promise<
  PublishedDesignOption[]
> {
  const rows = await db
    .select({
      id: designs.id,
      name: designs.name,
      slug: designs.slug,
      ogAssetId: designs.ogAssetId,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"))
    .orderBy(asc(designs.name))
    .limit(500);

  if (rows.length === 0) return [];

  const tags = await db
    .select({
      designId: designTags.designId,
      value: designTags.value,
    })
    .from(designTags)
    .where(
      and(
        eq(designTags.kind, "FREE"),
        inArray(
          designTags.designId,
          rows.map((r) => r.id),
        ),
      ),
    );

  const doorByDesign = new Map<string, string>();
  const doorSet = new Set(HOUSE_COLLECTIONS.map((c) => c.tag));
  for (const t of tags) {
    const upper = t.value.toUpperCase();
    if (doorSet.has(upper) && !doorByDesign.has(t.designId)) {
      doorByDesign.set(t.designId, upper);
    }
  }

  return rows.map((r) => ({
    ...r,
    houseDoor: doorByDesign.get(r.id) ?? null,
  }));
}

export async function countPublishedDesignsForCategory(
  categoryKey: string,
): Promise<number> {
  const keys = [...new Set(houseDoorTagKeys(categoryKey))];
  if (keys.length === 0) return 0;

  const [row] = await db
    .select({ n: sql<number>`count(distinct ${designs.id})` })
    .from(designs)
    .innerJoin(designTags, eq(designTags.designId, designs.id))
    .where(
      and(
        eq(designs.status, "PUBLISHED"),
        eq(designTags.kind, "FREE"),
        inArray(designTags.value, keys),
      ),
    );

  return Number(row?.n ?? 0);
}

export async function listPublishedDesignThumbsForCategory(
  categoryKey: string,
  limit = 6,
): Promise<Array<{ id: string; name: string; ogAssetId: string | null }>> {
  const keys = [...new Set(houseDoorTagKeys(categoryKey))];
  if (keys.length === 0) return [];

  return db
    .select({
      id: designs.id,
      name: designs.name,
      ogAssetId: designs.ogAssetId,
    })
    .from(designs)
    .innerJoin(designTags, eq(designTags.designId, designs.id))
    .where(
      and(
        eq(designs.status, "PUBLISHED"),
        eq(designTags.kind, "FREE"),
        inArray(designTags.value, keys),
      ),
    )
    .orderBy(asc(designs.name))
    .limit(limit);
}
