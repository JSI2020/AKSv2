import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import {
  accounts,
  addresses,
  auditLogs,
  carts,
  customerMeasurementProfiles,
  customerProfiles,
  db,
  measurementFlowSessions,
  newsletterSubscribers,
  sessions,
  tryonConsents,
  tryonSessions,
  users,
  verificationTokens,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { HOUSE_PLACEHOLDER_DOMAIN } from "@/modules/auth/social/identity";

import type { DeletionOutcome } from "./meta-deletion";

const SOCIAL_PROVIDERS = ["facebook", "instagram"] as const;

function deletedEmail(userId: string, kind: "account" | "list"): string {
  const local =
    kind === "account" ? `deleted.${userId}` : `deleted.list.${userId}`;
  return `${local}${HOUSE_PLACEHOLDER_DOMAIN}`;
}

/**
 * Remove account data for a Facebook or Instagram user id from a valid
 * deletion callback. Order rows and their snapshots are left as they are.
 * A staff login is not changed.
 */
export async function eraseProviderAccount(
  providerUserId: string,
): Promise<DeletionOutcome> {
  const links = await db
    .select({
      userId: accounts.userId,
      role: users.role,
    })
    .from(accounts)
    .innerJoin(users, eq(users.id, accounts.userId))
    .where(
      and(
        eq(accounts.providerAccountId, providerUserId),
        inArray(accounts.provider, [...SOCIAL_PROVIDERS]),
      ),
    );

  if (links.length === 0) return "none";

  let erased = false;
  let kept = false;
  for (const link of links) {
    if (link.role !== "CUSTOMER") {
      kept = true;
      continue;
    }
    await eraseCustomer(link.userId);
    erased = true;
  }
  if (erased) return "erased";
  if (kept) return "kept";
  return "none";
}

async function eraseCustomer(userId: string): Promise<void> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.role !== "CUSTOMER") return;

  const now = new Date();
  const priorEmail = user.email;
  const priorPhone = user.phone;

  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(addresses).where(eq(addresses.userId, userId));
    await tx
      .delete(customerMeasurementProfiles)
      .where(eq(customerMeasurementProfiles.userId, userId));
    await tx
      .delete(measurementFlowSessions)
      .where(eq(measurementFlowSessions.userId, userId));

    const tokenIds = [
      priorEmail,
      priorPhone ? `wa:${priorPhone}` : null,
    ].filter((value): value is string => Boolean(value));
    if (tokenIds.length > 0) {
      await tx
        .delete(verificationTokens)
        .where(inArray(verificationTokens.identifier, tokenIds));
    }

    await tx
      .update(newsletterSubscribers)
      .set({
        email: deletedEmail(userId, "list"),
        unsubscribedAt: now,
        userId: null,
        updatedAt: now,
      })
      .where(eq(newsletterSubscribers.email, priorEmail));
    await tx
      .update(newsletterSubscribers)
      .set({ userId: null, updatedAt: now })
      .where(eq(newsletterSubscribers.userId, userId));

    await tx
      .update(carts)
      .set({ userId: null, updatedAt: now })
      .where(eq(carts.userId, userId));
    await tx
      .update(tryonConsents)
      .set({ userId: null, ipAddress: null, userAgent: null })
      .where(eq(tryonConsents.userId, userId));
    await tx
      .update(tryonSessions)
      .set({ userId: null, updatedAt: now })
      .where(eq(tryonSessions.userId, userId));

    await tx
      .update(customerProfiles)
      .set({
        whatsappNumber: null,
        internalNotes: null,
        tags: [],
        acceptsMarketing: false,
        updatedAt: now,
      })
      .where(eq(customerProfiles.userId, userId));

    await tx
      .update(users)
      .set({
        email: deletedEmail(userId, "account"),
        name: null,
        phone: null,
        emailVerified: null,
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
        status: "DISABLED",
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    await tx.insert(auditLogs).values({
      id: uuidv7(),
      actorId: null,
      actorRole: "SYSTEM",
      action: "customer.data_deletion",
      entityType: "user",
      entityId: userId,
      before: { providersCleared: true },
      after: { status: "DISABLED", accountEmailCleared: true },
    });
  });
}
