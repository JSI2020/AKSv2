"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  categoryTiles,
  db,
  designTags,
  designs,
  discounts,
  houseCollections,
  insertAuditLog,
  navItems,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import {
  getHouseCollectionById,
  listHouseCollections,
} from "@/modules/catalog/house-collections-queries";
import type { DbTx } from "@/modules/platform/types";

import {
  allocateItemNumber,
  formatItemNumber,
  rebuildItemNumberKeepingQuartet,
} from "@/modules/designs/item-number";

export type HouseCollectionActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type HouseCollectionAdminRow = {
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
  designCount: number;
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function normalizeTag(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function normalizeItemCode(input: string): string {
  return input.trim().toLowerCase().slice(0, 2);
}

async function countDesignsForTag(tag: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(designTags)
    .where(and(eq(designTags.kind, "FREE"), eq(designTags.value, tag)));
  return Number(row?.n ?? 0);
}

async function migrateCollectionReferences(
  tx: DbTx,
  from: { tag: string; slug: string },
  to: { tag: string; slug: string; itemCode: string },
): Promise<number> {
  const tagRows = await tx
    .select({ designId: designTags.designId })
    .from(designTags)
    .where(and(eq(designTags.kind, "FREE"), eq(designTags.value, from.tag)));

  for (const row of tagRows) {
    await tx
      .update(designTags)
      .set({ value: to.tag })
      .where(
        and(
          eq(designTags.designId, row.designId),
          eq(designTags.kind, "FREE"),
          eq(designTags.value, from.tag),
        ),
      );

    const [design] = await tx
      .select({ id: designs.id, itemNumber: designs.itemNumber })
      .from(designs)
      .where(eq(designs.id, row.designId))
      .limit(1);
    if (!design) continue;

    let nextNumber =
      rebuildItemNumberKeepingQuartet(design.itemNumber, to.itemCode) ??
      formatItemNumber(to.itemCode, "AAAA");
    const clash = await tx
      .select({ id: designs.id })
      .from(designs)
      .where(eq(designs.itemNumber, nextNumber))
      .limit(1);
    if (clash[0] && clash[0].id !== design.id) {
      nextNumber = await allocateItemNumber(to.itemCode, async (candidate) => {
        const rows = await tx
          .select({ id: designs.id })
          .from(designs)
          .where(eq(designs.itemNumber, candidate))
          .limit(1);
        return Boolean(rows[0] && rows[0].id !== design.id);
      });
    }

    await tx
      .update(designs)
      .set({ itemNumber: nextNumber, updatedAt: new Date() })
      .where(eq(designs.id, design.id));
  }

  await tx
    .update(categoryTiles)
    .set({ categoryKey: to.slug, updatedAt: new Date() })
    .where(eq(categoryTiles.categoryKey, from.slug));

  const navRows = await tx.select().from(navItems);
  for (const item of navRows) {
    const link = item.link;
    if (
      link?.type === "collection" &&
      link.value.trim().toLowerCase() === from.slug
    ) {
      await tx
        .update(navItems)
        .set({
          link: { ...link, value: to.slug },
          updatedAt: new Date(),
        })
        .where(eq(navItems.id, item.id));
    }
  }

  const discountRows = await tx.select().from(discounts);
  for (const disc of discountRows) {
    if (
      disc.appliesTo !== "COLLECTION" &&
      disc.appliesTo !== "CATEGORY"
    ) {
      continue;
    }
    const nextIds = disc.targetIds.map((id) => {
      if (disc.appliesTo === "COLLECTION" && id.toLowerCase() === from.slug) {
        return to.slug;
      }
      if (
        disc.appliesTo === "CATEGORY" &&
        id.toUpperCase() === from.tag.toUpperCase()
      ) {
        return to.tag;
      }
      return id;
    });
    if (nextIds.join("|") !== disc.targetIds.join("|")) {
      await tx
        .update(discounts)
        .set({ targetIds: nextIds, updatedAt: new Date() })
        .where(eq(discounts.id, disc.id));
    }
  }

  return tagRows.length;
}

function revalidateCollectionPaths(slug?: string): void {
  revalidatePath("/admin/content/collections");
  revalidatePath("/admin/content");
  revalidatePath("/admin/content/homepage");
  revalidatePath("/admin/content/nav");
  revalidatePath("/admin/designs");
  revalidatePath("/collections", "layout");
  revalidatePath("/", "layout");
  if (slug) {
    revalidatePath(`/collections/${slug}`);
  }
}

export async function listHouseCollectionsAdmin(): Promise<
  HouseCollectionAdminRow[]
> {
  await requirePermission("content.view");
  const rows = await listHouseCollections({ activeOnly: false });
  const counts = await Promise.all(
    rows.map(async (r) => ({
      tag: r.tag,
      n: await countDesignsForTag(r.tag),
    })),
  );
  const countByTag = new Map(counts.map((c) => [c.tag, c.n]));
  return rows.map((r) => ({
    ...r,
    designCount: countByTag.get(r.tag) ?? 0,
  }));
}

export async function saveHouseCollectionAction(input: {
  id?: string;
  title: string;
  navLabel: string;
  tag?: string;
  slug?: string;
  itemCode?: string;
  tagline?: string;
  card?: string;
  intro?: string;
  sortOrder?: number;
  active?: boolean;
}): Promise<HouseCollectionActionResult> {
  try {
    const session = await requirePermission("content.edit");
    const title = input.title.trim();
    const navLabel = input.navLabel.trim() || title;
    const tagline = (input.tagline ?? "").trim();
    const card = (input.card ?? "").trim();
    const intro = (input.intro ?? "").trim();
    const sortOrder = input.sortOrder ?? 0;
    const active = input.active ?? true;

    if (!title) return { ok: false, error: "Title is required" };

    const slug = slugify(input.slug ?? title);
    const tag = normalizeTag(input.tag ?? slug.replace(/-/g, "_"));
    const itemCode = normalizeItemCode(input.itemCode ?? slug.slice(0, 2));

    if (!slug || !tag || itemCode.length !== 2) {
      return { ok: false, error: "Invalid slug, tag, or item code" };
    }

    if (input.id) {
      const before = await getHouseCollectionById(input.id);
      if (!before) return { ok: false, error: "Collection not found" };

      const identityChanged =
        before.slug !== slug ||
        before.tag !== tag ||
        before.itemCode !== itemCode;

      if (identityChanged) {
        const [slugClash] = await db
          .select({ id: houseCollections.id })
          .from(houseCollections)
          .where(
            and(
              eq(houseCollections.slug, slug),
              sql`${houseCollections.id} <> ${input.id}`,
            ),
          )
          .limit(1);
        if (slugClash) {
          return { ok: false, error: "Another collection uses this slug" };
        }
        const [tagClash] = await db
          .select({ id: houseCollections.id })
          .from(houseCollections)
          .where(
            and(
              eq(houseCollections.tag, tag),
              sql`${houseCollections.id} <> ${input.id}`,
            ),
          )
          .limit(1);
        if (tagClash) {
          return { ok: false, error: "Another collection uses this tag" };
        }
        const [codeClash] = await db
          .select({ id: houseCollections.id })
          .from(houseCollections)
          .where(
            and(
              eq(houseCollections.itemCode, itemCode),
              sql`${houseCollections.id} <> ${input.id}`,
            ),
          )
          .limit(1);
        if (codeClash) {
          return { ok: false, error: "Another collection uses this item code" };
        }
      }

      await db.transaction(async (tx) => {
        if (identityChanged) {
          await migrateCollectionReferences(
            tx as DbTx,
            { tag: before.tag, slug: before.slug },
            { tag, slug, itemCode },
          );
        }

        await tx
          .update(houseCollections)
          .set({
            tag,
            slug,
            itemCode,
            navLabel,
            title,
            tagline,
            card,
            intro,
            sortOrder,
            active,
            updatedAt: new Date(),
          })
          .where(eq(houseCollections.id, input.id!));

        await insertAuditLog(tx as never, {
          id: uuidv7(),
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "content.house_collection.update",
          entityType: "house_collection",
          entityId: input.id!,
          before: before,
          after: { tag, slug, title, active },
        });
      });

      revalidateCollectionPaths(before.slug);
      revalidateCollectionPaths(slug);
      return { ok: true, id: input.id };
    }

    const [slugClash] = await db
      .select({ id: houseCollections.id })
      .from(houseCollections)
      .where(eq(houseCollections.slug, slug))
      .limit(1);
    if (slugClash) return { ok: false, error: "Slug already in use" };

    const id = uuidv7();
    await db.insert(houseCollections).values({
      id,
      tag,
      slug,
      itemCode,
      navLabel,
      title,
      tagline,
      card,
      intro,
      sortOrder,
      active,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.house_collection.create",
      entityType: "house_collection",
      entityId: id,
      before: null,
      after: { tag, slug, title },
    });

    revalidateCollectionPaths(slug);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}

export async function deleteHouseCollectionAction(input: {
  id: string;
  migrateToId?: string | null;
}): Promise<HouseCollectionActionResult> {
  try {
    const session = await requirePermission("content.edit");
    const row = await getHouseCollectionById(input.id);
    if (!row) return { ok: false, error: "Collection not found" };

    const designCount = await countDesignsForTag(row.tag);
    let migrateTo: Awaited<ReturnType<typeof getHouseCollectionById>> = null;

    if (designCount > 0) {
      if (!input.migrateToId) {
        return {
          ok: false,
          error: `${designCount} design(s) use this door — pick a collection to move them to.`,
        };
      }
      migrateTo = await getHouseCollectionById(input.migrateToId);
      if (!migrateTo) {
        return { ok: false, error: "Target collection not found" };
      }
      if (migrateTo.id === row.id) {
        return { ok: false, error: "Pick a different target collection" };
      }
    }

    await db.transaction(async (tx) => {
      if (migrateTo && designCount > 0) {
        await migrateCollectionReferences(
          tx as DbTx,
          { tag: row.tag, slug: row.slug },
          {
            tag: migrateTo.tag,
            slug: migrateTo.slug,
            itemCode: migrateTo.itemCode,
          },
        );
      }

      await tx
        .delete(houseCollections)
        .where(eq(houseCollections.id, input.id));

      await insertAuditLog(tx as never, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "content.house_collection.delete",
        entityType: "house_collection",
        entityId: input.id,
        before: row,
        after: migrateTo
          ? { migratedTo: migrateTo.id, designsMoved: designCount }
          : null,
      });
    });

    revalidateCollectionPaths(row.slug);
    if (migrateTo) revalidateCollectionPaths(migrateTo.slug);
    return { ok: true, id: input.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Delete failed",
    };
  }
}

export async function setHouseCollectionActiveAction(input: {
  id: string;
  active: boolean;
}): Promise<HouseCollectionActionResult> {
  try {
    const session = await requirePermission("content.edit");
    const row = await getHouseCollectionById(input.id);
    if (!row) return { ok: false, error: "Collection not found" };

    await db
      .update(houseCollections)
      .set({ active: input.active, updatedAt: new Date() })
      .where(eq(houseCollections.id, input.id));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: input.active
        ? "content.house_collection.activate"
        : "content.house_collection.archive",
      entityType: "house_collection",
      entityId: input.id,
      before: { active: row.active },
      after: { active: input.active },
    });

    revalidateCollectionPaths(row.slug);
    return { ok: true, id: input.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed",
    };
  }
}
