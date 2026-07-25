import { and, desc, eq } from "drizzle-orm";

import { assets, db, orders, payments, users } from "@aks/db";

import { requirePermission } from "@/modules/auth";
import { createPresignedReadUrl } from "@/modules/platform/assets";

export type VerificationQueueItem = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  kind: string;
  customerName: string;
  submittedAt: Date;
  receiptUrl: string | null;
};

export async function listAwaitingVerificationPayments(): Promise<
  VerificationQueueItem[]
> {
  await requirePermission("money.verify_payments");

  const rows = await db
    .select({
      paymentId: payments.id,
      orderId: payments.orderId,
      orderNumber: orders.orderNumber,
      amountMinor: payments.amountMinor,
      kind: payments.kind,
      submittedAt: payments.createdAt,
      recipientName: orders.shippingAddressSnapshot,
      customerName: users.name,
      r2Key: assets.r2Key,
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .leftJoin(users, eq(orders.userId, users.id))
    .leftJoin(assets, eq(payments.receiptAssetId, assets.id))
    .where(eq(payments.status, "AWAITING_VERIFICATION"))
    .orderBy(desc(payments.createdAt));

  const items: VerificationQueueItem[] = [];
  for (const row of rows) {
    const snapshot = row.recipientName as { recipientName?: string } | null;
    let receiptUrl: string | null = null;
    if (row.r2Key) {
      receiptUrl = await createPresignedReadUrl(row.r2Key, 3600);
    }
    items.push({
      paymentId: row.paymentId,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      amountMinor: row.amountMinor,
      kind: row.kind,
      customerName:
        row.customerName ?? snapshot?.recipientName ?? "Guest customer",
      submittedAt: row.submittedAt,
      receiptUrl,
    });
  }

  return items;
}

export async function getOrderForBankTransfer(orderNumber: string) {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      depositAmountMinor: orders.depositAmountMinor,
      balanceAmountMinor: orders.balanceAmountMinor,
      totalMinor: orders.totalMinor,
      paymentPlan: orders.paymentPlan,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (!order) return null;

  const [pending] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.orderId, order.id),
        eq(payments.status, "AWAITING_VERIFICATION"),
      ),
    )
    .limit(1);

  return {
    ...order,
    hasPendingVerification: Boolean(pending),
  };
}
