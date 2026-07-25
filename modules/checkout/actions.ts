"use server";

import { revalidatePath } from "next/cache";

import { addresses, db } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { auth } from "@/auth";
import { getOrSetAnonToken } from "@/modules/measure";
import {
  getActiveCartId,
  hydrateCart,
  type CartContext,
} from "@/modules/cart/queries";
import {
  CHECKOUT_GUEST_ACTOR_ID,
} from "@/modules/orders/constants";
import { buildStandardMeasurementSnapshot } from "@/modules/orders/compute-cut-spec-snapshot";
import { placeOrderCore } from "@/modules/orders/place-order-core";
import { getCustomerCodStatus } from "@/modules/payments/cod/customer-profile";
import { evaluateCheckoutDiscounts } from "@/modules/discounts/evaluate";

import {
  computeDepositAmounts,
  isPaymentPlanAllowed,
} from "./payment-plans";
import { validateCheckoutAddress, validatePaymentPlan } from "./schemas";
import type {
  ApplyCheckoutDiscountResult,
  CheckoutDiscountPreview,
  PlaceOrderInput,
  PlaceOrderResult,
} from "./types";
import { toShippingSnapshot } from "./types";
import {
  loadMeasurementSnapshot,
  validateCartForCheckout,
  type ValidatedCartLine,
} from "./validate";

async function getCartContext(): Promise<CartContext> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getOrSetAnonToken();
  return { userId, anonId };
}

function toDiscountLines(lines: ValidatedCartLine[]) {
  return lines.map((line) => ({
    designId: line.designId,
    garmentTypeId: line.garmentTypeId,
    lineTotalMinor: line.lineTotalMinor,
  }));
}

export async function applyCheckoutDiscount(input: {
  code: string;
  paymentPlan: PlaceOrderInput["paymentPlan"];
}): Promise<ApplyCheckoutDiscountResult> {
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
    };
  }

  const shippingMinor = 0;
  const taxMinor = 0;

  const evaluation = await evaluateCheckoutDiscounts({
    lines: toDiscountLines(validation.lines),
    subtotalMinor: validation.subtotalMinor,
    shippingMinor,
    taxMinor,
    code: input.code,
    userId: ctx.userId,
  });

  if (!evaluation.ok) {
    return { ok: false, error: evaluation.error };
  }

  const amounts = computeDepositAmounts({
    totalMinor: evaluation.totalMinor,
    plan: planResult.plan,
  });

  return {
    ok: true,
    preview: {
      code: input.code.trim().toUpperCase(),
      subtotalMinor: evaluation.subtotalMinor,
      discountMinor: evaluation.discountMinor,
      shippingMinor: evaluation.shippingMinor,
      taxMinor: evaluation.taxMinor,
      totalMinor: evaluation.totalMinor,
      depositAmountMinor: amounts.depositAmountMinor,
      balanceAmountMinor: amounts.balanceAmountMinor,
    },
  };
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
  const codStatus = await getCustomerCodStatus(ctx.userId);
  if (
    !isPaymentPlanAllowed(
      planResult.plan,
      lines.map((l) => ({ sizeMode: l.sizeMode })),
      { codDisabled: codStatus.codDisabled },
    )
  ) {
    return {
      ok: false,
      error: codStatus.codDisabled
        ? "Cash on delivery is not available on your account. Choose pay in full."
        : "Made-to-measure pieces cannot use the half-now plan. Choose 70% deposit or pay in full.",
    };
  }

  const subtotalMinor = validation.subtotalMinor;
  const shippingMinor = 0;
  const taxMinor = 0;

  const evaluation = await evaluateCheckoutDiscounts({
    lines: toDiscountLines(lines),
    subtotalMinor,
    shippingMinor,
    taxMinor,
    code: input.discountCode,
    userId: ctx.userId,
    guestEmail: addressResult.data.guestEmail,
  });

  if (!evaluation.ok) {
    return { ok: false, error: evaluation.error };
  }

  const discountMinor = evaluation.discountMinor;
  const totalMinor = evaluation.totalMinor;
  computeDepositAmounts({ totalMinor, plan: planResult.plan });

  const shippingSnapshot = toShippingSnapshot(addressResult.data);
  const actorId = ctx.userId ?? CHECKOUT_GUEST_ACTOR_ID;

  try {
    const { orderNumber, orderId } = await db.transaction(async (tx) => {
      const resolvedLines = [];

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

        resolvedLines.push({
          designId: line.designId,
          colourwayId: line.colourwayId,
          designSlug: line.designSlug,
          designName: line.designName,
          sizeMode: line.sizeMode,
          sizeLabel: line.sizeLabel,
          measurementSnapshot,
          customizationSelections: line.customizationSelections,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          lineTotalMinor: line.lineTotalMinor,
          priceBreakdown: line.priceBreakdown,
        });
      }

      const result = await placeOrderCore(
        {
          userId: ctx.userId,
          guestEmail: addressResult.data.guestEmail ?? null,
          guestPhone: addressResult.data.phone,
          whatsappNumber: addressResult.data.whatsappNumber,
          shippingAddressSnapshot: shippingSnapshot,
          paymentPlan: planResult.plan,
          customerNotes: input.customerNotes,
          source: "WEB",
          cartId,
          subtotalMinor,
          discountMinor,
          discountBreakdownSnapshot: evaluation.breakdown,
          shippingMinor: evaluation.shippingMinor,
          taxMinor,
          totalMinor,
          lines: resolvedLines,
          actor: { id: actorId },
          transitionNote: "Guest checkout placed",
        },
        tx,
      );

      const now = new Date();

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

      return result;
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

export async function getCheckoutCodStatus() {
  const session = await auth();
  return getCustomerCodStatus(session?.user?.id ?? null);
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
