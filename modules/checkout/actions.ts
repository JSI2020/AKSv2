"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  addresses,
  cartLines,
  carts,
  db,
  orderItems,
  orders,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { auth } from "@/auth";
import { getOrSetAnonToken } from "@/modules/measure";
import { enqueue } from "@/modules/platform/outbox/enqueue";
import { transition } from "@/modules/platform/transition";
import {
  getActiveCartId,
  hydrateCart,
  type CartContext,
} from "@/modules/cart/queries";
import { generateOrderNumber } from "@/modules/orders/order-number";
import {
  CHECKOUT_GUEST_ACTOR_ID,
} from "@/modules/orders/constants";
import { computeCutSpecSnapshot, buildStandardMeasurementSnapshot } from "@/modules/orders/compute-cut-spec-snapshot";
import { ORDER_TRANSITION_ALLOW } from "@/modules/orders/transitions";

import "@/modules/orders/transitions";
import {
  computeDepositAmounts,
  isPaymentPlanAllowed,
} from "./payment-plans";
import { validateCheckoutAddress, validatePaymentPlan } from "./schemas";
import type { PlaceOrderInput, PlaceOrderResult } from "./types";
import { toShippingSnapshot } from "./types";
import {
  loadMeasurementSnapshot,
  validateCartForCheckout,
} from "./validate";

async function getCartContext(): Promise<CartContext> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getOrSetAnonToken();
  return { userId, anonId };
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const addressResult = validateCheckoutAddress(input.address);
  if (!addressResult.ok) {
    return { ok: false, error: addressResult.error };
  }

  const planResult = validatePaymentPlan(input.paymentPlan);
  if (!planResult.ok) {
    return { ok: false, error: planResult.error };
  }

  const ctx = await getCartContext();
  const cartId = await getActiveCartId(ctx);
  if (!cartId) {
    return { ok: false, error: "Your cart is empty." };
  }

  const validation = await validateCartForCheckout(cartId);
  if (!validation.ok) {
    return {
      ok: false,
      error: "Something in your cart changed. Review the details below.",
      issues: validation.issues.map((issue) => issue.message),
    };
  }

  const lines = validation.lines;
  if (
    !isPaymentPlanAllowed(planResult.plan, lines.map((l) => ({ sizeMode: l.sizeMode })))
  ) {
    return {
      ok: false,
      error:
        "Made-to-measure pieces cannot use the half-now plan. Choose 70% deposit or pay in full.",
    };
  }

  const subtotalMinor = validation.subtotalMinor;
  const shippingMinor = 0;
  const discountMinor = 0;
  const taxMinor = 0;
  const totalMinor = subtotalMinor + shippingMinor + taxMinor - discountMinor;
  const { depositAmountMinor, balanceAmountMinor } = computeDepositAmounts({
    totalMinor,
    plan: planResult.plan,
  });

  const shippingSnapshot = toShippingSnapshot(addressResult.data);
  const orderId = uuidv7();
  const now = new Date();
  const actorId = ctx.userId ?? CHECKOUT_GUEST_ACTOR_ID;

  try {
    const orderNumber = await db.transaction(async (tx) => {
      const generatedNumber = await generateOrderNumber(tx);

      await tx.insert(orders).values({
        id: orderId,
        orderNumber: generatedNumber,
        userId: ctx.userId,
        guestEmail: addressResult.data.guestEmail ?? null,
        guestPhone: addressResult.data.phone,
        whatsappNumber: addressResult.data.whatsappNumber,
        status: "DRAFT",
        currency: "PKR",
        subtotalMinor,
        discountMinor,
        shippingMinor,
        taxMinor,
        totalMinor,
        depositAmountMinor,
        balanceAmountMinor,
        paymentPlan: planResult.plan,
        shippingAddressSnapshot: shippingSnapshot,
        customerNotes: input.customerNotes?.trim() || null,
        source: "WEB",
        cartId,
        createdAt: now,
        updatedAt: now,
      });

      for (const line of lines) {
        let measurementSnapshot;
        if (line.sizeMode === "MADE_TO_MEASURE" && line.measurementProfileId) {
          measurementSnapshot = await loadMeasurementSnapshot(
            line.measurementProfileId,
          );
          if (!measurementSnapshot) {
            throw new Error(
              `Measurements missing for ${line.designName}. Complete them before checkout.`,
            );
          }
        } else if (line.sizeMode === "STANDARD" && line.sizeLabel) {
          measurementSnapshot = await buildStandardMeasurementSnapshot(
            {
              designId: line.designId,
              sizeLabel: line.sizeLabel,
            },
            tx,
          );
        } else {
          throw new Error(
            `Size configuration missing for ${line.designName}.`,
          );
        }

        const cutSpecSnapshot = await computeCutSpecSnapshot(
          {
            designId: line.designId,
            colourwayId: line.colourwayId,
            sizeMode: line.sizeMode,
            sizeLabel: line.sizeLabel,
            measurementSnapshot,
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
          measurementSnapshot,
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
        actor: { id: actorId },
        note: "Guest checkout placed",
        allowList: ORDER_TRANSITION_ALLOW,
        tx,
      });

      await tx
        .update(carts)
        .set({ status: "CONVERTED", updatedAt: now })
        .where(and(eq(carts.id, cartId), eq(carts.status, "ACTIVE")));

      await tx.delete(cartLines).where(eq(cartLines.cartId, cartId));

      if (ctx.userId && addressResult.data.saveAddress) {
        await tx.insert(addresses).values({
          id: uuidv7(),
          userId: ctx.userId,
          label: addressResult.data.addressLabel ?? "Home",
          recipientName: addressResult.data.recipientName,
          phone: addressResult.data.phone,
          addressLine1: addressResult.data.addressLine1,
          addressLine2: addressResult.data.addressLine2 ?? null,
          city: addressResult.data.city,
          province: addressResult.data.province,
          postalCode: addressResult.data.postalCode ?? null,
          landmark: addressResult.data.landmark ?? null,
          isDefaultShipping: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      await enqueue(
        "order.placed",
        {
          orderId,
          orderNumber: generatedNumber,
          whatsappNumber: addressResult.data.whatsappNumber,
        },
        tx,
      );

      return generatedNumber;
    });

    revalidatePath("/", "layout");

    return { ok: true, orderNumber, orderId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not place your order.";
    return { ok: false, error: message };
  }
}

export async function getCheckoutCart() {
  const ctx = await getCartContext();
  const cartId = await getActiveCartId(ctx);
  if (!cartId) return null;
  return hydrateCart(cartId);
}

export async function validateCheckoutCart() {
  const ctx = await getCartContext();
  const cartId = await getActiveCartId(ctx);
  if (!cartId) {
    return {
      ok: false as const,
      issues: [{ message: "Your cart is empty." }],
    };
  }
  const result = await validateCartForCheckout(cartId);
  if (!result.ok) {
    return { ok: false as const, issues: result.issues };
  }
  return { ok: true as const, lines: result.lines, subtotalMinor: result.subtotalMinor };
}
