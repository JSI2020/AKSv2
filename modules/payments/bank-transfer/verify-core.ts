import { eq } from "drizzle-orm";

import { orders, payments } from "@aks/db";

import { CHECKOUT_GUEST_ACTOR_ID } from "@/modules/orders/constants";
import { transitionOrder } from "@/modules/orders/transition-order";
import "@/modules/orders/transitions";
import { enqueue } from "@/modules/platform/outbox/enqueue";
import type { DbTx } from "@/modules/platform/types";

export async function applyVerifiedBankTransfer(
  input: {
    paymentId: string;
    verifiedById: string;
    verifiedByRole?: string;
  },
  tx: DbTx,
): Promise<{ orderId: string; orderNumber: string }> {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.id, input.paymentId))
    .limit(1);

  if (!payment) throw new Error("Payment not found.");
  if (payment.status !== "AWAITING_VERIFICATION") {
    throw new Error("Payment is not awaiting verification.");
  }
  if (payment.provider !== "BANK_TRANSFER") {
    throw new Error("Only bank transfer payments can be verified here.");
  }

  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1);

  if (!order) throw new Error("Order not found.");

  const now = new Date();

  await tx
    .update(payments)
    .set({
      status: "SUCCEEDED",
      verifiedById: input.verifiedById,
      verifiedAt: now,
    })
    .where(eq(payments.id, input.paymentId));

  if (order.status === "AWAITING_DEPOSIT" && payment.kind !== "BALANCE") {
    await transitionOrder({
      orderId: order.id,
      from: "AWAITING_DEPOSIT",
      to: "DEPOSIT_PAID",
      actor: { id: input.verifiedById, role: input.verifiedByRole },
      note: "Bank transfer verified",
      tx,
    });
  }

  await enqueue(
    "payment.verified",
    {
      paymentId: input.paymentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountMinor: payment.amountMinor,
      kind: payment.kind,
      provider: "BANK_TRANSFER",
      verifiedById: input.verifiedById,
    },
    tx,
  );

  return { orderId: order.id, orderNumber: order.orderNumber };
}

export async function applyRejectedBankTransfer(
  input: {
    paymentId: string;
    reason: string;
    rejectedById: string;
  },
  tx: DbTx,
): Promise<{ orderId: string; orderNumber: string }> {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.id, input.paymentId))
    .limit(1);

  if (!payment) throw new Error("Payment not found.");
  if (payment.status !== "AWAITING_VERIFICATION") {
    throw new Error("Payment is not awaiting verification.");
  }

  const [order] = await tx
    .select({ id: orders.id, orderNumber: orders.orderNumber })
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1);

  if (!order) throw new Error("Order not found.");

  await tx
    .update(payments)
    .set({
      status: "FAILED",
      rawPayload: { rejectionReason: input.reason.trim() },
    })
    .where(eq(payments.id, input.paymentId));

  await enqueue(
    "payment.rejected",
    {
      paymentId: input.paymentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountMinor: payment.amountMinor,
      reason: input.reason.trim(),
      rejectedById: input.rejectedById,
    },
    tx,
  );

  return { orderId: order.id, orderNumber: order.orderNumber };
}

export { CHECKOUT_GUEST_ACTOR_ID };
