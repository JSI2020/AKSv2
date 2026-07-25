import { eq } from "drizzle-orm";

import { orderItems, orders, productionJobs } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import type { DbTx } from "@/modules/platform/types";

import { transitionOrder } from "@/modules/orders/transition-order";
import type { OrderStatus } from "@/modules/orders/constants";

import { enterCuttingStage } from "./cutting";

/** Create one board job per order item when measurements are confirmed. */
export async function createProductionJobsForOrder(
  orderId: string,
  actor: { id: string; role?: string },
  tx: DbTx,
): Promise<void> {
  const [order] = await tx
    .select({ promisedShipDate: orders.promisedShipDate, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const items = await tx
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  let created = false;

  for (const item of items) {
    const existing = await tx
      .select({ id: productionJobs.id })
      .from(productionJobs)
      .where(eq(productionJobs.orderItemId, item.id))
      .limit(1);

    if (existing.length > 0) continue;

    await tx.insert(productionJobs).values({
      id: uuidv7(),
      orderItemId: item.id,
      stage: "CUTTING",
      status: "PENDING",
      dueAt: order.promisedShipDate,
    });
    created = true;
  }

  if (created && order.status === "MEASUREMENTS_CONFIRMED") {
    await enterCuttingStage(orderId, actor, tx);
    await transitionOrder({
      orderId,
      from: "MEASUREMENTS_CONFIRMED",
      to: "CUTTING",
      actor,
      tx,
    });
  }
}
