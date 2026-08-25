import "server-only";

import { and, eq, or, isNull, lte, gte } from "drizzle-orm";

import { db, discounts } from "@aks/db";

import { automaticPercentForDesign } from "./badge-math";

export type AutomaticPercentDiscount = {
  id: string;
  value: number;
  appliesTo:
    | "ORDER"
    | "COLLECTION"
    | "CATEGORY"
    | "DESIGN"
    | "GARMENT_TYPE";
  targetIds: string[];
};

export { automaticPercentForDesign };

/**
 * Active automatic (no-code) percentage discounts for storefront badges.
 * % off is computed — never typed on the product.
 */
export async function loadActiveAutomaticPercentDiscounts(): Promise<
  AutomaticPercentDiscount[]
> {
  const now = new Date();
  const rows = await db
    .select({
      id: discounts.id,
      value: discounts.value,
      appliesTo: discounts.appliesTo,
      targetIds: discounts.targetIds,
      code: discounts.code,
    })
    .from(discounts)
    .where(
      and(
        eq(discounts.status, "ACTIVE"),
        eq(discounts.type, "PERCENTAGE"),
        or(isNull(discounts.startsAt), lte(discounts.startsAt, now)),
        or(isNull(discounts.endsAt), gte(discounts.endsAt, now)),
      ),
    );

  return rows
    .filter((r) => !r.code)
    .map((r) => ({
      id: r.id,
      value: r.value,
      appliesTo: r.appliesTo,
      targetIds: r.targetIds,
    }));
}
