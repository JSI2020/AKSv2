"use server";

import { desc } from "drizzle-orm";

import { db, newsletterSubscribers } from "@aks/db";

import { requirePermission } from "@/modules/auth";

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  source: string;
  locale: string | null;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
};

export type NewsletterSubscribersData = {
  rows: NewsletterSubscriberRow[];
  activeCount: number;
  totalCount: number;
};

/** All footer subscribers, newest first — gated by customers.view. */
export async function listNewsletterSubscribers(): Promise<NewsletterSubscribersData> {
  await requirePermission("customers.view");

  const rows = await db
    .select({
      id: newsletterSubscribers.id,
      email: newsletterSubscribers.email,
      source: newsletterSubscribers.source,
      locale: newsletterSubscribers.locale,
      subscribedAt: newsletterSubscribers.createdAt,
      unsubscribedAt: newsletterSubscribers.unsubscribedAt,
    })
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.createdAt))
    .limit(1000);

  const activeCount = rows.filter((r) => r.unsubscribedAt === null).length;

  return { rows, activeCount, totalCount: rows.length };
}
