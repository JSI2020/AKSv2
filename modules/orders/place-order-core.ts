import { and, eq } from "drizzle-orm";

import {
  cartLines,
  carts,
  orderItems,
  orders,
  type OrderDiscountBreakdownSnapshot,
  type OrderPriceBreakdownSnapshot,
  type OrderMeasurementSnapshot,
  type ShippingAddressSnapshot,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import type { PaymentPlan } from "@/modules/checkout/payment-plans";
import { computeDepositAmounts } from "@/modules/checkout/payment-plans";
import { recordDiscountRedemptions } from "@/modules/discounts/evaluate";
import { transition } from "@/modules/platform/transition";
import type { DbTx } from "@/modules/platform/types";

import { computeCutSpecSnapshot } from "./compute-cut-spec-snapshot";
import { generateOrderNumber } from "./order-number";
import { ORDER_TRANSITION_ALLOW } from "./transitions";

import "./transitions";

export type PlaceOrderLineInput = {
  designId: string;
  colourwayId: string;
  designSlug: string;
  designName: string;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  measurementSnapshot: OrderMeasurementSnapshot;
  customizationSelections: Record<string, string | boolean>;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  priceBreakdown: OrderPriceBreakdownSnapshot;
};

export type PlaceOrderCoreInput = {
  userId: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  whatsappNumber: string;
  shippingAddressSnapshot: ShippingAddressSnapshot;
  paymentPlan: PaymentPlan;
  customerNotes?: string | null;
  internalNotes?: string | null;
  source: "WEB" | "WHATSAPP" | "INSTAGRAM" | "PHONE" | "WALK_IN";
  cartId?: string | null;
  subtotalMinor: number;
  discountMinor?: number;
  discountBreakdownSnapshot?: OrderDiscountBreakdownSnapshot | null;
  shippingMinor?: number;
  taxMinor?: number;
  totalMinor: number;
  lines: PlaceOrderLineInput[];
  actor: { id: string; role?: string };
  transitionNote: string;
};

export type PlaceOrderCoreResult = {
  orderId: string;
  orderNumber: string;
};

export async function placeOrderCore(
  input: PlaceOrderCoreInput,
  tx: DbTx,
): Promise<PlaceOrderCoreResult> {
  if (input.lines.length === 0) {
    throw new Error("Add at least one item before placing the order.");
  }

  const orderId = uuidv7();
  const now = new Date();
  const discountMinor = input.discountMinor ?? 0;
  const shippingMinor = input.shippingMinor ?? 0;
  const taxMinor = input.taxMinor ?? 0;
  const discountBreakdownSnapshot = input.discountBreakdownSnapshot ?? null;
  const { depositAmountMinor, balanceAmountMinor } = computeDepositAmounts({
    totalMinor: input.totalMinor,
    plan: input.paymentPlan,
  });

  const orderNumber = await generateOrderNumber(tx);

  await tx.insert(orders).values({
    id: orderId,
    orderNumber,
    userId: input.userId,
    guestEmail: input.guestEmail ?? null,
    guestPhone: input.guestPhone ?? null,
    whatsappNumber: input.whatsappNumber,
    status: "DRAFT",
    currency: "PKR",
    subtotalMinor: input.subtotalMinor,
    discountMinor,
    discountBreakdownSnapshot,
    shippingMinor,
    taxMinor,
    totalMinor: input.totalMinor,
    depositAmountMinor,
    balanceAmountMinor,
    paymentPlan: input.paymentPlan,
    shippingAddressSnapshot: input.shippingAddressSnapshot,
    customerNotes: input.customerNotes?.trim() || null,
    internalNotes: input.internalNotes?.trim() || null,
    source: input.source,
    cartId: input.cartId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  for (const line of input.lines) {
    if (!line.measurementSnapshot) {
      throw new Error(
        `Measurements missing for ${line.designName}. Complete them before placing.`,
      );
    }

    const cutSpecSnapshot = await computeCutSpecSnapshot(
      {
        designId: line.designId,
        colourwayId: line.colourwayId,
        sizeMode: line.sizeMode,
        sizeLabel: line.sizeLabel,
        measurementSnapshot: line.measurementSnapshot,
      },
      tx,
    );

    await tx.insert(orderItems).values({
      id: uuidv7(),
      orderId,
      designId: line.designId,
      colourwayId: line.colourwayId,
      designSnapshot: {
        name: line.designName,
        slug: line.designSlug,
      },
      sizeMode: line.sizeMode,
      sizeLabel: line.sizeLabel,
      measurementSnapshot: line.measurementSnapshot,
      customizationSnapshot: line.customizationSelections,
      priceBreakdownSnapshot: line.priceBreakdown,
      cutSpecSnapshot,
      unitPriceMinor: line.unitPriceMinor,
      quantity: line.quantity,
      lineTotalMinor: line.lineTotalMinor,
      createdAt: now,
    });
  }

  await transition({
    entity: "order",
    id: orderId,
    from: "DRAFT",
    to: "AWAITING_DEPOSIT",
    actor: input.actor,
    note: input.transitionNote,
    allowList: ORDER_TRANSITION_ALLOW,
    tx,
  });

  if (discountBreakdownSnapshot && discountBreakdownSnapshot.applied.length > 0) {
    await recordDiscountRedemptions(tx, {
      orderId,
      userId: input.userId,
      guestEmail: input.guestEmail ?? null,
      breakdown: discountBreakdownSnapshot,
    });
  }

  if (input.cartId) {
    await tx
      .update(carts)
      .set({ status: "CONVERTED", updatedAt: now })
      .where(and(eq(carts.id, input.cartId), eq(carts.status, "ACTIVE")));

    await tx.delete(cartLines).where(eq(cartLines.cartId, input.cartId));
  }

  // Note: customer notification is driven by the DRAFT → AWAITING_DEPOSIT
  // transition above (order.transitioned → order.received email). We do not
  // emit a separate "order.placed" event — nothing consumes it.

  return { orderId, orderNumber };
}
