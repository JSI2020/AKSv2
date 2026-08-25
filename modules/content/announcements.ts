import "server-only";

import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";

import { announcements, db } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { resolveContentLink } from "./links";
import type { AnnouncementPublic } from "./types";

function inWindowNow() {
  const now = new Date();
  return and(
    or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
    or(isNull(announcements.endsAt), gte(announcements.endsAt, now)),
  );
}

export async function listAnnouncementsAdmin() {
  return db
    .select()
    .from(announcements)
    .orderBy(asc(announcements.sortOrder), asc(announcements.createdAt));
}

export async function listActiveAnnouncements(): Promise<AnnouncementPublic[]> {
  const rows = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.active, true), inWindowNow()))
    .orderBy(asc(announcements.sortOrder), asc(announcements.createdAt));

  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    href: r.link ? resolveContentLink(r.link) : null,
  }));
}

export async function upsertAnnouncement(input: {
  id?: string;
  message: string;
  link?: { type: string; value: string } | null;
  active: boolean;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
}): Promise<string> {
  const id = input.id ?? uuidv7();
  const link = input.link
    ? {
        type: input.link.type as
          | "collection"
          | "design"
          | "page"
          | "url"
          | "hash"
          | "none",
        value: input.link.value,
      }
    : null;

  if (input.id) {
    await db
      .update(announcements)
      .set({
        message: input.message,
        link,
        active: input.active,
        sortOrder: input.sortOrder,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id));
  } else {
    await db.insert(announcements).values({
      id,
      message: input.message,
      link,
      active: input.active,
      sortOrder: input.sortOrder,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
  }
  return id;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await db.delete(announcements).where(eq(announcements.id, id));
}
