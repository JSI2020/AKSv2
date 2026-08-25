import "server-only";

import { and, asc, eq } from "drizzle-orm";

import {
  contentLists,
  contentPageEvents,
  contentPages,
  db,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import {
  registerEntityTransitions,
  type TransitionAllowList,
} from "@/modules/platform/transition";

import type { ContentListItem, ContentPagePublic } from "./types";

export const CONTENT_PAGE_ALLOW: TransitionAllowList = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

let registered = false;

export function registerContentPageTransitions(): void {
  if (registered) return;
  registered = true;
  registerEntityTransitions("content_page", {
    applyStatusChange: async (tx, id, from, to) => {
      const patch: {
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
        publishedAt?: Date | null;
      } = {
        status: to as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        updatedAt: new Date(),
      };
      if (to === "PUBLISHED") {
        patch.publishedAt = new Date();
      }

      const rows = await tx
        .update(contentPages)
        .set(patch)
        .where(
          and(
            eq(contentPages.id, id),
            eq(
              contentPages.status,
              from as "DRAFT" | "PUBLISHED" | "ARCHIVED",
            ),
          ),
        )
        .returning({ id: contentPages.id, version: contentPages.version });

      if (rows[0] && to === "PUBLISHED") {
        await tx
          .update(contentPages)
          .set({ version: (rows[0].version ?? 1) + 1 })
          .where(eq(contentPages.id, id));
      }
      return rows.length;
    },
    insertEvent: async (tx, row) => {
      await tx.insert(contentPageEvents).values(row);
    },
  });
}

registerContentPageTransitions();

export async function listContentPagesAdmin() {
  return db.select().from(contentPages).orderBy(asc(contentPages.slug));
}

export async function getPublishedPage(
  slug: string,
): Promise<ContentPagePublic | null> {
  const rows = await db
    .select()
    .from(contentPages)
    .where(
      and(eq(contentPages.slug, slug), eq(contentPages.status, "PUBLISHED")),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { slug: row.slug, title: row.title, body: row.body };
}

export async function upsertContentPage(input: {
  id?: string;
  slug: string;
  title: string;
  body: string;
}): Promise<string> {
  const id = input.id ?? uuidv7();
  if (input.id) {
    await db
      .update(contentPages)
      .set({
        slug: input.slug,
        title: input.title,
        body: input.body,
        updatedAt: new Date(),
      })
      .where(eq(contentPages.id, id));
  } else {
    await db.insert(contentPages).values({
      id,
      slug: input.slug,
      title: input.title,
      body: input.body,
      status: "DRAFT",
    });
  }
  return id;
}

export async function getContentPageById(id: string) {
  const rows = await db
    .select()
    .from(contentPages)
    .where(eq(contentPages.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getContentList(key: string): Promise<ContentListItem[]> {
  const rows = await db
    .select()
    .from(contentLists)
    .where(eq(contentLists.key, key))
    .limit(1);
  return (rows[0]?.items as ContentListItem[]) ?? [];
}

export async function upsertContentList(
  key: string,
  items: ContentListItem[],
): Promise<void> {
  const existing = await db
    .select({ id: contentLists.id })
    .from(contentLists)
    .where(eq(contentLists.key, key))
    .limit(1);
  if (existing[0]) {
    await db
      .update(contentLists)
      .set({ items, updatedAt: new Date() })
      .where(eq(contentLists.key, key));
  } else {
    await db.insert(contentLists).values({
      id: uuidv7(),
      key,
      items,
    });
  }
}
