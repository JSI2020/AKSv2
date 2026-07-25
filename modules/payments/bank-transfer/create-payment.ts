import { and, eq } from "drizzle-orm";

import { db, orders, payments } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { enqueue } from "@/modules/platform/outbox/enqueue";
import type { DbTx } from "@/modules/platform/types";

import type { PaymentKind } from "../types";

function inferPaymentKind(input: {
  amountMinor: number;
  depositAmountMinor: number;
  totalMinor: number;
}): PaymentKind {
  if (input.amountMinor >= input.totalMinor) return "FULL";
  if (input.amountMinor >= input.depositAmountMinor) return "DEPOSIT";
  return "DEPOSIT";
}

export async function createBankTransferPayment(
  input: {
    orderNumber: string;
    receiptAssetId: string;
  },
  tx: DbTx,
): Promise<{ paymentId: string; orderId: string }> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, input.orderNumber.trim()))
    .limit(1);

  if (!order) {
    throw new Error("Order not found.");
  }
  if (order.status !== "AWAITING_DEPOSIT") {
    throw new Error(
      "This order is not waiting for a deposit. Contact us if you need help.",
    );
  }

  const [existing] = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.orderId, order.id),
        eq(payments.status, "AWAITING_VERIFICATION"),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error(
      "We already have a receipt for this order — it is being verified.",
    );
  }

  const amountMinor = order.depositAmountMinor;
  const kind = inferPaymentKind({
    amountMinor,
    depositAmountMinor: order.depositAmountMinor,
    totalMinor: order.totalMinor,
  });

  const paymentId = uuidv7();
  const idempotencyKey = `bank-transfer:${order.id}:${paymentId}`;

  await tx.insert(payments).values({
    id: paymentId,
    orderId: order.id,
    provider: "BANK_TRANSFER",
    kind,
    amountMinor,
    currency: "PKR",
    status: "AWAITING_VERIFICATION",
    idempotencyKey,
    receiptAssetId: input.receiptAssetId,
  });

  await enqueue(
    "payment.awaiting_verification",
    {
      paymentId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountMinor,
      kind,
      provider: "BANK_TRANSFER",
    },
    tx,
  );

  return { paymentId, orderId: order.id };
}

export async function createBankTransferPaymentStandalone(input: {
  orderNumber: string;
  receiptAssetId: string;
}): Promise<{ paymentId: string; orderId: string }> {
  return db.transaction((tx) => createBankTransferPayment(input, tx));
}
