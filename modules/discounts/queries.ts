import { desc, eq, sql } from "drizzle-orm";

import { db, discountRedemptions, discounts } from "@aks/db";

import { requirePermission } from "@/modules/auth";

export type DiscountListRow = {
  id: string;
  code: string | null;
  name: string;
  type: (typeof discounts.$inferSelect)["type"];
  value: number;
  appliesTo: (typeof discounts.$inferSelect)["appliesTo"];
  minSpendMinor: number;
  maxDiscountMinor: number | null;
  firstOrderOnly: boolean;
  oncePerCustomer: boolean;
  usageLimit: number | null;
  usageCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  stackable: boolean;
  status: (typeof discounts.$inferSelect)["status"];
  targetIds: string[];
  redeemedMinor: number;
  redemptionCount: number;
};

export async function listDiscounts(): Promise<DiscountListRow[]> {
  await requirePermission("discounts.view");

  const rows = await db
    .select({
      id: discounts.id,
      code: discounts.code,
      name: discounts.name,
      type: discounts.type,
      value: discounts.value,
      appliesTo: discounts.appliesTo,
      minSpendMinor: discounts.minSpendMinor,
      maxDiscountMinor: discounts.maxDiscountMinor,
      firstOrderOnly: discounts.firstOrderOnly,
      oncePerCustomer: discounts.oncePerCustomer,
      usageLimit: discounts.usageLimit,
      usageCount: discounts.usageCount,
      startsAt: discounts.startsAt,
      endsAt: discounts.endsAt,
      stackable: discounts.stackable,
      status: discounts.status,
      targetIds: discounts.targetIds,
      redeemedMinor: sql<number>`coalesce(sum(${discountRedemptions.amountMinor}), 0)`,
      redemptionCount: sql<number>`count(${discountRedemptions.id})`,
    })
    .from(discounts)
    .leftJoin(
      discountRedemptions,
      eq(discountRedemptions.discountId, discounts.id),
    )
    .groupBy(discounts.id)
    .orderBy(desc(discounts.updatedAt));

  return rows.map((row) => ({
    ...row,
    redeemedMinor: Number(row.redeemedMinor),
    redemptionCount: Number(row.redemptionCount),
  }));
}

export async function getDiscountById(id: string) {
  await requirePermission("discounts.view");

  const [row] = await db
    .select()
    .from(discounts)
    .where(eq(discounts.id, id))
    .limit(1);

  return row ?? null;
}
