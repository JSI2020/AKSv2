import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import {
  codRemittances,
  db,
  orderPayments,
  orders,
  payments,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { enqueue } from "@/modules/platform/outbox/enqueue";
import type { DbTx } from "@/modules/platform/types";

/** Record COD balance collected when an order is delivered. */
export async function recordCodBalanceOnDelivery(
  orderId: string,
  actorId: string,
  tx: DbTx,
): Promise<void> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.balanceAmountMinor <= 0) return;

  const [existingProvider] = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.orderId, orderId),
        eq(payments.provider, "COD"),
        eq(payments.kind, "BALANCE"),
        inArray(payments.status, ["SUCCEEDED", "AWAITING_VERIFICATION"]),
      ),
    )
    .limit(1);

  const [existingManual] = await tx
    .select({ id: orderPayments.id })
    .from(orderPayments)
    .where(
      and(
        eq(orderPayments.orderId, orderId),
        eq(orderPayments.provider, "COD"),
        eq(orderPayments.kind, "BALANCE"),
        eq(orderPayments.status, "SUCCEEDED"),
      ),
    )
    .limit(1);

  if (existingProvider || existingManual) return;

  const paymentId = uuidv7();
  await tx.insert(payments).values({
    id: paymentId,
    orderId,
    provider: "COD",
    kind: "BALANCE",
    amountMinor: order.balanceAmountMinor,
    currency: "PKR",
    status: "SUCCEEDED",
    idempotencyKey: `cod-balance:${orderId}`,
    rawPayload: { collectedOnDelivery: true },
  });

  await enqueue(
    "payment.cod_collected",
    {
      paymentId,
      orderId,
      orderNumber: order.orderNumber,
      amountMinor: order.balanceAmountMinor,
      actorId,
    },
    tx,
  );
}

import { requirePermission } from "@/modules/auth";

export type OutstandingCodOrder = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  deliveredAt: Date | null;
  balanceMinor: number;
  courierHint: string | null;
};

export async function listOutstandingCodOrders(): Promise<OutstandingCodOrder[]> {
  await requirePermission("money.view");

  const remittanceRows = await db
    .select({ orderIds: codRemittances.orderIds })
    .from(codRemittances);
  const remittedIds = new Set(remittanceRows.flatMap((r) => r.orderIds));

  const codPayments = await db
    .select({
      orderId: payments.orderId,
      amountMinor: payments.amountMinor,
    })
    .from(payments)
    .where(
      and(
        eq(payments.provider, "COD"),
        eq(payments.status, "SUCCEEDED"),
        eq(payments.kind, "BALANCE"),
      ),
    );

  const outstandingOrderIds = codPayments
    .map((p) => p.orderId)
    .filter((id) => !remittedIds.has(id));

  if (outstandingOrderIds.length === 0) return [];

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      balanceAmountMinor: orders.balanceAmountMinor,
      placedAt: orders.placedAt,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.id, outstandingOrderIds),
        inArray(orders.status, ["DELIVERED", "COMPLETED"]),
      ),
    )
    .orderBy(orders.placedAt);

  return rows.map((row) => {
    const snapshot = row.shippingAddressSnapshot as {
      recipientName?: string;
      city?: string;
    };
    return {
      orderId: row.id,
      orderNumber: row.orderNumber,
      customerName: snapshot.recipientName ?? "Guest",
      deliveredAt: row.placedAt,
      balanceMinor: row.balanceAmountMinor,
      courierHint: snapshot.city ?? null,
    };
  });
}

export type CodRemittanceRow = {
  id: string;
  courier: string;
  remittanceRef: string;
  expectedAmountMinor: number;
  receivedAmountMinor: number;
  receivedAt: Date;
  orderIds: string[];
  discrepancyNote: string | null;
  hasDiscrepancy: boolean;
};

export async function listCodRemittances(): Promise<CodRemittanceRow[]> {
  await requirePermission("money.view");

  const rows = await db
    .select()
    .from(codRemittances)
    .orderBy(sql`${codRemittances.receivedAt} desc`);

  return rows.map((row) => ({
    id: row.id,
    courier: row.courier,
    remittanceRef: row.remittanceRef,
    expectedAmountMinor: row.expectedAmountMinor,
    receivedAmountMinor: row.receivedAmountMinor,
    receivedAt: row.receivedAt,
    orderIds: row.orderIds,
    perOrderExpected: row.perOrderExpected ?? {},
    discrepancyNote: row.discrepancyNote,
    hasDiscrepancy: row.expectedAmountMinor !== row.receivedAmountMinor,
    shortfallMinor: Math.max(
      0,
      row.expectedAmountMinor - row.receivedAmountMinor,
    ),
  }));
}

export async function createCodRemittance(
  input: {
    courier: string;
    remittanceRef: string;
    expectedAmountMinor: number;
    receivedAmountMinor: number;
    receivedAt: Date;
    orderIds: string[];
    /** Snapshot of expected balance per order (paisa). Built if omitted. */
    perOrderExpected?: Record<string, number>;
    discrepancyNote?: string;
    recordedById: string;
  },
  tx: DbTx,
): Promise<string> {
  if (input.orderIds.length === 0) {
    throw new Error("Select at least one delivered COD order.");
  }

  const delivered = await tx
    .select({ id: orders.id, balanceAmountMinor: orders.balanceAmountMinor })
    .from(orders)
    .where(
      and(
        inArray(orders.id, input.orderIds),
        inArray(orders.status, ["DELIVERED", "COMPLETED"]),
      ),
    );

  if (delivered.length !== input.orderIds.length) {
    throw new Error("All selected orders must be delivered.");
  }

  const alreadyRemitted = await tx
    .select({ orderIds: codRemittances.orderIds })
    .from(codRemittances);

  const remittedSet = new Set(alreadyRemitted.flatMap((r) => r.orderIds));
  for (const orderId of input.orderIds) {
    if (remittedSet.has(orderId)) {
      throw new Error(`Order ${orderId} is already linked to a remittance.`);
    }
  }

  const perOrderExpected: Record<string, number> =
    input.perOrderExpected ??
    Object.fromEntries(
      delivered.map((o) => [o.id, o.balanceAmountMinor] as const),
    );

  const computedExpected = Object.values(perOrderExpected).reduce(
    (sum, n) => sum + n,
    0,
  );
  const expectedAmountMinor =
    input.expectedAmountMinor > 0
      ? input.expectedAmountMinor
      : computedExpected;

  let discrepancyNote = input.discrepancyNote?.trim() || null;
  if (expectedAmountMinor !== input.receivedAmountMinor && !discrepancyNote) {
    discrepancyNote = `Expected ${expectedAmountMinor} paisa, received ${input.receivedAmountMinor} paisa. Per-order sum: ${computedExpected} paisa.`;
  }

  const id = uuidv7();
  await tx.insert(codRemittances).values({
    id,
    courier: input.courier.trim(),
    remittanceRef: input.remittanceRef.trim(),
    expectedAmountMinor,
    receivedAmountMinor: input.receivedAmountMinor,
    receivedAt: input.receivedAt,
    orderIds: input.orderIds,
    perOrderExpected,
    discrepancyNote,
    recordedById: input.recordedById,
  });

  await enqueue(
    "cod.remittance_recorded",
    {
      remittanceId: id,
      courier: input.courier.trim(),
      remittanceRef: input.remittanceRef.trim(),
      expectedAmountMinor,
      receivedAmountMinor: input.receivedAmountMinor,
      orderIds: input.orderIds,
      perOrderExpected,
      hasDiscrepancy: expectedAmountMinor !== input.receivedAmountMinor,
    },
    tx,
  );

  return id;
}

/** Orders eligible for remittance matching — delivered with COD balance, not yet remitted. */
export async function listRemittableCodOrders() {
  await requirePermission("money.manage_cod");

  const remittanceRows = await db
    .select({ orderIds: codRemittances.orderIds })
    .from(codRemittances);
  const remittedIds = remittanceRows.flatMap((r) => r.orderIds);

  const conditions = [
    inArray(orders.status, ["DELIVERED", "COMPLETED"]),
    sql`${orders.balanceAmountMinor} > 0`,
  ];

  if (remittedIds.length > 0) {
    conditions.push(notInArray(orders.id, remittedIds));
  }

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      balanceAmountMinor: orders.balanceAmountMinor,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
    })
    .from(orders)
    .where(and(...conditions))
    .orderBy(orders.orderNumber);

  return rows.map((row) => {
    const snapshot = row.shippingAddressSnapshot as { recipientName?: string };
    return {
      orderId: row.id,
      orderNumber: row.orderNumber,
      balanceMinor: row.balanceAmountMinor,
      customerName: snapshot.recipientName ?? "Guest",
    };
  });
}
