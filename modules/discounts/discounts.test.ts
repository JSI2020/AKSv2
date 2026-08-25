import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  db,
  discountRedemptions,
  discounts,
  orders,
  sql,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { computeDepositAmounts } from "@/modules/checkout/payment-plans";
import { generateOrderNumber } from "@/modules/orders/order-number";

import { evaluateCheckoutDiscounts, recordDiscountRedemptions } from "./evaluate";
import { ensureDiscountsSchema } from "./test-setup";

describe("checkout discounts", () => {
  beforeAll(async () => {
    await ensureDiscountsSchema();
    // Clear leftover rows from interrupted prior runs (shared test DB).
    await db.delete(discountRedemptions);
    await db.delete(discounts);
  });

  afterAll(async () => {
    await db.delete(discountRedemptions);
    await db.delete(discounts);
    await db.delete(orders);
    await sql.end({ timeout: 5 });
  });

  it("applies a first-order percentage code with min spend, snapshots onto order, and blocks reuse", async () => {
    const discountId = uuidv7();
    const code = `WELCOME15-${discountId.slice(0, 8)}`;
    const guestEmail = `discount-${uuidv7()}@example.com`;
    const subtotalMinor = 30_000_00;

    await db.insert(discounts).values({
      id: discountId,
      code,
      name: "Welcome 15",
      type: "PERCENTAGE",
      value: 15,
      appliesTo: "ORDER",
      targetIds: [],
      minSpendMinor: 25_000_00,
      maxDiscountMinor: null,
      firstOrderOnly: true,
      oncePerCustomer: true,
      usageLimit: 100,
      usageCount: 0,
      stackable: false,
      status: "ACTIVE",
    });

    const lines = [
      {
        designId: uuidv7(),
        garmentTypeId: uuidv7(),
        lineTotalMinor: subtotalMinor,
      },
    ];

    const evaluation = await evaluateCheckoutDiscounts({
      lines,
      subtotalMinor,
      shippingMinor: 0,
      taxMinor: 0,
      code,
      guestEmail,
    });

    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) return;

    expect(evaluation.discountMinor).toBe(4_500_00);
    expect(evaluation.totalMinor).toBe(25_500_00);
    expect(evaluation.breakdown.applied).toHaveLength(1);

    const { depositAmountMinor, balanceAmountMinor } = computeDepositAmounts({
      totalMinor: evaluation.totalMinor,
      plan: "DEPOSIT_70_COD_30",
    });
    expect(depositAmountMinor).toBe(17_850_00);
    expect(balanceAmountMinor).toBe(7_650_00);

    const orderId = uuidv7();
    const orderNumber = await db.transaction((tx) => generateOrderNumber(tx));

    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      guestEmail,
      whatsappNumber: "+923001234567",
      status: "AWAITING_DEPOSIT",
      subtotalMinor,
      discountMinor: evaluation.discountMinor,
      discountBreakdownSnapshot: evaluation.breakdown,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: evaluation.totalMinor,
      depositAmountMinor,
      balanceAmountMinor,
      paymentPlan: "DEPOSIT_70_COD_30",
      shippingAddressSnapshot: {
        recipientName: "Discount Tester",
        phone: "+923001234567",
        whatsappNumber: "+923001234567",
        addressLine1: "12 Mall Road",
        addressLine2: null,
        city: "Lahore",
        province: "PUNJAB",
        postalCode: null,
        landmark: null,
      },
    });

    await db.transaction(async (tx) => {
      await recordDiscountRedemptions(tx, {
        orderId,
        userId: null,
        guestEmail,
        breakdown: evaluation.breakdown,
      });
    });

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    expect(order?.discountMinor).toBe(4_500_00);
    expect(order?.totalMinor).toBe(25_500_00);
    expect(order?.depositAmountMinor).toBe(17_850_00);
    expect(order?.discountBreakdownSnapshot?.applied[0]?.discountId).toBe(
      discountId,
    );

    const [discountRow] = await db
      .select({ usageCount: discounts.usageCount })
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);
    expect(discountRow?.usageCount).toBe(1);

    const secondAttempt = await evaluateCheckoutDiscounts({
      lines,
      subtotalMinor,
      shippingMinor: 0,
      taxMinor: 0,
      code,
      guestEmail,
    });

    expect(secondAttempt.ok).toBe(false);
    if (secondAttempt.ok) return;
    expect(secondAttempt.error).toMatch(/cannot be applied/i);

    await expect(
      db.transaction(async (tx) =>
        recordDiscountRedemptions(tx, {
          orderId: uuidv7(),
          userId: null,
          guestEmail,
          breakdown: evaluation.breakdown,
        }),
      ),
    ).rejects.toThrow(/already been used/i);
  });
});
