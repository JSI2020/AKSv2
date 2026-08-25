import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db, navItems } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { resolveContentLink } from "./links";
import type { NavItemPublic } from "./types";

export async function listNavItemsAdmin(area?: "HEADER" | "FOOTER") {
  if (area) {
    return db
      .select()
      .from(navItems)
      .where(eq(navItems.area, area))
      .orderBy(asc(navItems.sortOrder));
  }
  return db.select().from(navItems).orderBy(asc(navItems.area), asc(navItems.sortOrder));
}

export async function listActiveNav(
  area: "HEADER" | "FOOTER",
): Promise<NavItemPublic[]> {
  const rows = await db
    .select()
    .from(navItems)
    .where(and(eq(navItems.area, area), eq(navItems.active, true)))
    .orderBy(asc(navItems.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    href: resolveContentLink(r.link),
    columnKey: r.columnKey,
  }));
}

export async function upsertNavItem(input: {
  id?: string;
  area: "HEADER" | "FOOTER";
  columnKey: string | null;
  label: string;
  link: { type: string; value: string };
  sortOrder: number;
  active: boolean;
}): Promise<string> {
  const id = input.id ?? uuidv7();
  const link = {
    type: input.link.type as
      | "collection"
      | "design"
      | "page"
      | "url"
      | "hash"
      | "none",
    value: input.link.value,
  };
  const values = {
    area: input.area,
    columnKey: input.columnKey,
    label: input.label,
    link,
    sortOrder: input.sortOrder,
    active: input.active,
    updatedAt: new Date(),
  };
  if (input.id) {
    await db.update(navItems).set(values).where(eq(navItems.id, id));
  } else {
    await db.insert(navItems).values({ id, ...values });
  }
  return id;
}

export async function deleteNavItem(id: string): Promise<void> {
  await db.delete(navItems).where(eq(navItems.id, id));
}
