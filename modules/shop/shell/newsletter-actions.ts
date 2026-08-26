"use server";

import { randomUUID } from "crypto";

import { db, newsletterSubscribers } from "@aks/db";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewsletterResult = { ok: true } | { ok: false; error: "invalid" | "failed" };

/**
 * Persist a storefront footer subscription. Idempotent by email: a repeat
 * (or a previously unsubscribed) address is re-activated rather than erroring.
 */
export async function subscribeToNewsletter(
  email: string,
  locale?: string,
): Promise<NewsletterResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || trimmed.length > 320 || !EMAIL.test(trimmed)) {
    return { ok: false, error: "invalid" };
  }
  try {
    await db
      .insert(newsletterSubscribers)
      .values({
        id: randomUUID(),
        email: trimmed,
        locale: locale ?? null,
        source: "footer",
      })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: { unsubscribedAt: null, updatedAt: new Date() },
      });
    return { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}
