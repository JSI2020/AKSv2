import { eq } from "drizzle-orm";

import { orderItems, orders, productionJobs } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import type { DbTx } from "@/modules/platform/types";

/**
 * Create one board job per order item when measurements are confirmed.
 * Jobs land in CUTTING/PENDING; fabric stays RESERVED until Cutting is entered
 * (order → CUTTING / job advances off the cutting column).
 */
export async function createProductionJobsForOrder(
  orderId: string,
  _actor: { id: string; role?: string },
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
  }
}
