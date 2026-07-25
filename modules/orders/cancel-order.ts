import { eq } from "drizzle-orm";

import { db, orders } from "@aks/db";

import type { TransitionActor } from "@/modules/platform/transition";
import type { DbTx } from "@/modules/platform/types";

import {
  ORDER_STATUS_ALLOW,
  type OrderStatus,
} from "./constants";
import { transitionOrder } from "./transition-order";

/** Statuses where cancellation returns deposit (pre-cutting gate). */
const PRE_MEASUREMENT_CANCEL: readonly OrderStatus[] = [
  "DRAFT",
  "AWAITING_DEPOSIT",
  "DEPOSIT_PAID",
];

/** Statuses where cancellation forfeits deposit (post MEASUREMENTS_CONFIRMED). */
const POST_MEASUREMENT_REFUND: readonly OrderStatus[] = [
  "MEASUREMENTS_CONFIRMED",
  "CUTTING",
  "STITCHING",
  "EMBROIDERY",
  "FINISHING",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "READY_TO_SHIP",
  "DISPATCHED",
  "DELIVERED",
];

export class OrderCancelError extends Error {
  readonly code = "ORDER_CANCEL_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "OrderCancelError";
  }
}

function resolveCancelTarget(status: OrderStatus): OrderStatus | null {
  if (PRE_MEASUREMENT_CANCEL.includes(status)) return "CANCELLED";
  if (POST_MEASUREMENT_REFUND.includes(status)) return "REFUND_PENDING";
  return null;
}

export async function cancelOrder(input: {
  orderId: string;
  reason: string;
  actor: TransitionActor;
  /** Required when cancelling after MEASUREMENTS_CONFIRMED (deposit forfeit). */
  acknowledgeDepositForfeit?: boolean;
  tx?: DbTx;
}): Promise<void> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new OrderCancelError("A cancellation reason is required.");
  }

  const run = async (tx: DbTx) => {
    const [order] = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw new OrderCancelError("Order not found.");
    }

    const from = order.status as OrderStatus;
    const to = resolveCancelTarget(from);
    if (!to) {
      throw new OrderCancelError(
        `Order in status ${from} cannot be cancelled.`,
      );
    }

    const allowed = ORDER_STATUS_ALLOW[from] ?? [];
    if (!(allowed as readonly OrderStatus[]).includes(to)) {
      throw new OrderCancelError(
        `Illegal cancellation for order in status ${from}.`,
      );
    }

    if (
      POST_MEASUREMENT_REFUND.includes(from) &&
      !input.acknowledgeDepositForfeit
    ) {
      throw new OrderCancelError(
        "Deposit is non-refundable after measurements are confirmed. Acknowledge forfeit to proceed.",
      );
    }

    await transitionOrder({
      orderId: input.orderId,
      from,
      to,
      actor: input.actor,
      note: reason,
      tx,
    });

    await tx
      .update(orders)
      .set({ cancelReason: reason, updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
  };

  if (input.tx) {
    await run(input.tx);
  } else {
    await db.transaction(run);
  }
}
