import { eq, sql } from "drizzle-orm";

import { customerProfiles, db } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { enqueue } from "@/modules/platform/outbox/enqueue";
import type { DbTx } from "@/modules/platform/types";

const COD_DISABLE_THRESHOLD = 1;

/** Increment refusal count and disable COD when threshold reached. */
export async function handleDeliveryRefused(
  userId: string | null,
  orderId: string,
  actorId: string,
  tx: DbTx,
): Promise<void> {
  if (!userId) return;

  const [existing] = await tx
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  const now = new Date();
  const nextCount = (existing?.codRefusalCount ?? 0) + 1;
  const codDisabled = nextCount >= COD_DISABLE_THRESHOLD;

  if (existing) {
    await tx
      .update(customerProfiles)
      .set({
        codRefusalCount: nextCount,
        codDisabled,
        updatedAt: now,
      })
      .where(eq(customerProfiles.userId, userId));
  } else {
    await tx.insert(customerProfiles).values({
      userId,
      codRefusalCount: nextCount,
      codDisabled,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (codDisabled) {
    await enqueue(
      "customer.cod_disabled",
      {
        userId,
        orderId,
        codRefusalCount: nextCount,
        actorId,
      },
      tx,
    );
  }
}

export async function getCustomerCodStatus(
  userId: string | null,
): Promise<{ codDisabled: boolean; codRefusalCount: number }> {
  if (!userId) {
    return { codDisabled: false, codRefusalCount: 0 };
  }

  const [profile] = await db
    .select({
      codDisabled: customerProfiles.codDisabled,
      codRefusalCount: customerProfiles.codRefusalCount,
    })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  return {
    codDisabled: profile?.codDisabled ?? false,
    codRefusalCount: profile?.codRefusalCount ?? 0,
  };
}

export async function ensureCustomerProfile(
  userId: string,
  whatsappNumber?: string | null,
  tx?: DbTx,
): Promise<void> {
  const runner = tx ?? db;
  const [existing] = await runner
    .select({ userId: customerProfiles.userId })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  if (existing) return;

  const now = new Date();
  await runner.insert(customerProfiles).values({
    userId,
    whatsappNumber: whatsappNumber ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

/** Sum lifetime value — utility for future customer module. */
export async function bumpCustomerOrderStats(
  userId: string,
  totalMinor: number,
  tx: DbTx,
): Promise<void> {
  await tx
    .update(customerProfiles)
    .set({
      totalOrdersCount: sql`${customerProfiles.totalOrdersCount} + 1`,
      lifetimeValueMinor: sql`${customerProfiles.lifetimeValueMinor} + ${totalMinor}`,
      updatedAt: new Date(),
    })
    .where(eq(customerProfiles.userId, userId));
}

export { uuidv7 };
