import { eq } from "drizzle-orm";

import { db, orders, payments } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { CHECKOUT_GUEST_ACTOR_ID } from "@/modules/orders/constants";
import { transitionOrder } from "@/modules/orders/transition-order";
import "@/modules/orders/transitions";
import { enqueue } from "@/modules/platform/outbox/enqueue";
import type { DbTx } from "@/modules/platform/types";

import { readSafepayConfig } from "./config";
import {
  PAYMENT_WEBHOOK_ACTOR_ID,
  SAFEPAY_SUCCESS_EVENTS,
} from "./constants";
import { getSafepayProvider } from "./providers/safepay";
import type { PaymentKind } from "./types";
import {
  PaymentProviderError,
  WebhookVerificationError,
  type WebhookVerificationContext,
} from "./types";

export type ProcessSafepayWebhookInput = {
  rawBody: string;
  signature: string;
  context: WebhookVerificationContext;
};

export type ProcessSafepayWebhookResult = {
  duplicate: boolean;
  processed: boolean;
  orderId?: string;
};

function inferPaymentKind(input: {
  amountMinor: number;
  depositAmountMinor: number;
  totalMinor: number;
  balanceAmountMinor: number;
}): PaymentKind {
  if (input.amountMinor >= input.totalMinor) {
    return "FULL";
  }
  if (input.amountMinor >= input.depositAmountMinor) {
    return "DEPOSIT";
  }
  if (input.balanceAmountMinor > 0 && input.amountMinor >= input.balanceAmountMinor) {
    return "BALANCE";
  }
  return "DEPOSIT";
}

async function findOrderByReference(
  tx: DbTx,
  orderReference: string,
): Promise<typeof orders.$inferSelect | null> {
  const [byNumber] = await tx
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderReference))
    .limit(1);
  if (byNumber) return byNumber;

  const [byId] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, orderReference))
    .limit(1);
  return byId ?? null;
}

export async function processSafepayWebhook(
  input: ProcessSafepayWebhookInput,
): Promise<ProcessSafepayWebhookResult> {
  const config = readSafepayConfig();
  const provider = getSafepayProvider(config);

  let event;
  try {
    event = provider.verifyWebhook(input.rawBody, input.signature, input.context);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      throw error;
    }
    throw error;
  }

  const isSuccessEvent = (
    SAFEPAY_SUCCESS_EVENTS as readonly string[]
  ).includes(event.eventType);

  if (!isSuccessEvent || event.status !== "SUCCEEDED") {
    return { duplicate: false, processed: false };
  }

  return db.transaction(async (tx) => {
    const order = await findOrderByReference(tx, event.orderReference);
    if (!order) {
      throw new PaymentProviderError(
        `No order found for Safepay reference "${event.orderReference}".`,
      );
    }

    const kind = inferPaymentKind({
      amountMinor: event.amountMinor,
      depositAmountMinor: order.depositAmountMinor,
      totalMinor: order.totalMinor,
      balanceAmountMinor: order.balanceAmountMinor,
    }) satisfies PaymentKind;

    const inserted = await tx
      .insert(payments)
      .values({
        id: uuidv7(),
        orderId: order.id,
        provider: "SAFEPAY",
        providerRef: event.providerRef,
        kind,
        amountMinor: event.amountMinor,
        currency: "PKR",
        status: "SUCCEEDED",
        rawPayload: event.raw,
        idempotencyKey: event.idempotencyKey,
      })
      .onConflictDoNothing({ target: payments.idempotencyKey })
      .returning({ id: payments.id });

    if (inserted.length === 0) {
      return { duplicate: true, processed: false, orderId: order.id };
    }

    const actorId = PAYMENT_WEBHOOK_ACTOR_ID;
    const fromStatus = order.status;

    if (fromStatus === "AWAITING_DEPOSIT" && kind !== "BALANCE") {
      await transitionOrder({
        orderId: order.id,
        from: "AWAITING_DEPOSIT",
        to: "DEPOSIT_PAID",
        actor: { id: actorId, role: "SYSTEM" },
        note: `Safepay ${event.eventType}`,
        tx,
      });
    }

    await enqueue(
      "payment.succeeded",
      {
        provider: "SAFEPAY",
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: inserted[0]!.id,
        providerRef: event.providerRef,
        kind,
        amountMinor: event.amountMinor,
        eventType: event.eventType,
        idempotencyKey: event.idempotencyKey,
        actorId: actorId ?? CHECKOUT_GUEST_ACTOR_ID,
      },
      tx,
    );

    return { duplicate: false, processed: true, orderId: order.id };
  });
}

export { readSafepayConfig, readSafepayConfigOrNull } from "./config";
export type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookEvent,
} from "./types";
export { getSafepayProvider, createSafepayProvider } from "./providers/safepay";
