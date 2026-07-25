import { and, count, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import {
  db,
  discountRedemptions,
  discounts,
  orders,
  type OrderDiscountBreakdownSnapshot,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { getPublishedDesigns } from "@/modules/catalog/queries";
import { resolveCollection } from "@/modules/catalog/resolve-collection";
import type { DbTx } from "@/modules/platform/types";

import {
  applicableSubtotalMinor,
  computeDiscountAmountParts,
  isDiscountScheduled,
  mergeDiscountParts,
  normalizeDiscountCode,
  selectAppliedDiscounts,
  type AppliedDiscountCandidate,
  type DiscountLineInput,
} from "./compute";

export type EvaluateDiscountsInput = {
  lines: DiscountLineInput[];
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  code?: string | null;
  userId?: string | null;
  guestEmail?: string | null;
  now?: Date;
};

export type EvaluateDiscountsResult =
  | {
      ok: true;
      subtotalMinor: number;
      shippingMinor: number;
      taxMinor: number;
      discountMinor: number;
      totalMinor: number;
      breakdown: OrderDiscountBreakdownSnapshot;
    }
  | { ok: false; error: string };

async function buildCollectionDesignMap(
  rows: (typeof discounts.$inferSelect)[],
): Promise<Map<string, Set<string>>> {
  const slugs = [
    ...new Set(
      rows
        .filter((row) => row.appliesTo === "COLLECTION")
        .flatMap((row) => row.targetIds),
    ),
  ];

  const map = new Map<string, Set<string>>();

  for (const slug of slugs) {
    const collection = await resolveCollection(slug);
    if (!collection) {
      map.set(slug, new Set());
      continue;
    }

    if (collection.baseFilters.designIds) {
      map.set(slug, new Set(collection.baseFilters.designIds));
      continue;
    }

    const ids = new Set<string>();
    let page = 1;
    let pageCount = 1;

    while (page <= pageCount) {
      const result = await getPublishedDesigns({
        baseFilters: collection.baseFilters,
        page,
        pageSize: 500,
      });
      for (const item of result.items) {
        ids.add(item.id);
      }
      pageCount = result.pageCount;
      page += 1;
    }

    map.set(slug, ids);
  }

  return map;
}

async function customerHasPriorOrder(input: {
  userId?: string | null;
  guestEmail?: string | null;
}): Promise<boolean> {
  const conditions = [ne(orders.status, "DRAFT"), ne(orders.status, "CANCELLED")];

  const identity = [];
  if (input.userId) {
    identity.push(eq(orders.userId, input.userId));
  }
  if (input.guestEmail?.trim()) {
    identity.push(eq(orders.guestEmail, input.guestEmail.trim().toLowerCase()));
  }

  if (identity.length === 0) return false;

  const [row] = await db
    .select({ total: count() })
    .from(orders)
    .where(and(...conditions, or(...identity)));

  return (row?.total ?? 0) > 0;
}

async function customerHasRedeemedDiscount(input: {
  discountId: string;
  userId?: string | null;
  guestEmail?: string | null;
}): Promise<boolean> {
  const identity = [];
  if (input.userId) {
    identity.push(eq(discountRedemptions.userId, input.userId));
  }
  if (input.guestEmail?.trim()) {
    identity.push(
      eq(discountRedemptions.guestEmail, input.guestEmail.trim().toLowerCase()),
    );
  }

  if (identity.length === 0) return false;

  const [row] = await db
    .select({ total: count() })
    .from(discountRedemptions)
    .where(
      and(
        eq(discountRedemptions.discountId, input.discountId),
        or(...identity),
      ),
    );

  return (row?.total ?? 0) > 0;
}

function discountPassesUsageLimit(
  discount: typeof discounts.$inferSelect,
): boolean {
  if (discount.usageLimit == null) return true;
  return discount.usageCount < discount.usageLimit;
}

async function loadActiveDiscountCandidates(
  code: string | null | undefined,
): Promise<{
  automatic: (typeof discounts.$inferSelect)[];
  codeDiscount: (typeof discounts.$inferSelect) | null;
}> {
  const automatic = await db
    .select()
    .from(discounts)
    .where(and(eq(discounts.status, "ACTIVE"), isNull(discounts.code)));

  if (!code?.trim()) {
    return { automatic, codeDiscount: null };
  }

  const normalized = normalizeDiscountCode(code);
  const [codeDiscount] = await db
    .select()
    .from(discounts)
    .where(
      and(
        eq(discounts.status, "ACTIVE"),
        sql`upper(trim(${discounts.code})) = ${normalized}`,
      ),
    )
    .limit(1);

  return { automatic, codeDiscount: codeDiscount ?? null };
}

function collectionDesignIdsForDiscount(
  discount: typeof discounts.$inferSelect,
  collectionMap: Map<string, Set<string>>,
): Set<string> {
  const ids = new Set<string>();
  for (const slug of discount.targetIds) {
    const resolved = collectionMap.get(slug);
    if (resolved) {
      for (const id of resolved) ids.add(id);
    }
  }
  return ids;
}

export async function evaluateCheckoutDiscounts(
  input: EvaluateDiscountsInput,
): Promise<EvaluateDiscountsResult> {
  const now = input.now ?? new Date();
  const normalizedCode = input.code?.trim()
    ? normalizeDiscountCode(input.code)
    : null;

  const { automatic, codeDiscount } =
    await loadActiveDiscountCandidates(normalizedCode);

  if (normalizedCode && !codeDiscount) {
    return { ok: false, error: "That discount code is not valid." };
  }

  const candidates = codeDiscount ? [...automatic, codeDiscount] : automatic;

  const collectionMap = await buildCollectionDesignMap(candidates);
  const hasPriorOrder = await customerHasPriorOrder({
    userId: input.userId,
    guestEmail: input.guestEmail,
  });

  const eligible: AppliedDiscountCandidate[] = [];

  for (const discount of candidates) {
    if (!isDiscountScheduled(discount, now)) continue;
    if (!discountPassesUsageLimit(discount)) continue;
    if (discount.firstOrderOnly && hasPriorOrder) continue;

    if (discount.oncePerCustomer) {
      const redeemed = await customerHasRedeemedDiscount({
        discountId: discount.id,
        userId: input.userId,
        guestEmail: input.guestEmail,
      });
      if (redeemed) continue;
    }

    if (input.subtotalMinor < discount.minSpendMinor) continue;

    const collectionDesignIds =
      discount.appliesTo === "COLLECTION"
        ? collectionDesignIdsForDiscount(discount, collectionMap)
        : new Set<string>();

    const scopedSubtotal = applicableSubtotalMinor(
      discount,
      input.lines,
      collectionDesignIds,
    );

    if (scopedSubtotal <= 0 && discount.type !== "FREE_SHIPPING") continue;

    const parts = computeDiscountAmountParts(
      discount,
      scopedSubtotal,
      input.shippingMinor,
    );

    if (parts.totalDiscountMinor <= 0) continue;

    eligible.push({ discount, parts });
  }

  if (normalizedCode) {
    const codeDiscount = eligible.find(
      (item) =>
        item.discount.code &&
        normalizeDiscountCode(item.discount.code) === normalizedCode,
    );
    if (!codeDiscount) {
      return {
        ok: false,
        error: "That discount code cannot be applied to this order.",
      };
    }
  }

  const selected = selectAppliedDiscounts(eligible);
  const merged = mergeDiscountParts(selected);

  const shippingMinor = Math.max(
    0,
    input.shippingMinor - merged.shippingDiscountMinor,
  );
  const discountMinor = merged.totalDiscountMinor;
  const totalMinor =
    input.subtotalMinor + shippingMinor + input.taxMinor - merged.lineDiscountMinor;

  const breakdown: OrderDiscountBreakdownSnapshot = {
    codeEntered: normalizedCode,
    lineDiscountMinor: merged.lineDiscountMinor,
    shippingDiscountMinor: merged.shippingDiscountMinor,
    totalDiscountMinor: discountMinor,
    applied: selected.map(({ discount, parts }) => ({
      discountId: discount.id,
      code: discount.code,
      name: discount.name,
      type: discount.type,
      amountMinor: parts.totalDiscountMinor,
    })),
  };

  return {
    ok: true,
    subtotalMinor: input.subtotalMinor,
    shippingMinor,
    taxMinor: input.taxMinor,
    discountMinor,
    totalMinor,
    breakdown,
  };
}

export async function recordDiscountRedemptions(
  tx: DbTx,
  input: {
    orderId: string;
    userId: string | null;
    guestEmail: string | null;
    breakdown: OrderDiscountBreakdownSnapshot;
  },
): Promise<void> {
  if (input.breakdown.applied.length === 0) return;

  const discountIds = input.breakdown.applied.map((row) => row.discountId);
  const rows = await tx
    .select()
    .from(discounts)
    .where(inArray(discounts.id, discountIds));

  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const applied of input.breakdown.applied) {
    const discount = byId.get(applied.discountId);
    if (!discount) {
      throw new Error("Discount is no longer available.");
    }

    if (
      discount.usageLimit != null &&
      discount.usageCount >= discount.usageLimit
    ) {
      throw new Error(`${discount.name} has reached its usage limit.`);
    }

    if (discount.oncePerCustomer) {
      const redeemed = await customerHasRedeemedDiscount({
        discountId: discount.id,
        userId: input.userId,
        guestEmail: input.guestEmail,
      });
      if (redeemed) {
        throw new Error(`${discount.name} has already been used on your account.`);
      }
    }

    await tx.insert(discountRedemptions).values({
      id: uuidv7(),
      discountId: applied.discountId,
      orderId: input.orderId,
      userId: input.userId,
      guestEmail: input.guestEmail?.trim().toLowerCase() ?? null,
      amountMinor: applied.amountMinor,
    });

    await tx
      .update(discounts)
      .set({
        usageCount: discount.usageCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(discounts.id, discount.id));
  }
}
