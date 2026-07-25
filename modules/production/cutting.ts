import { eq } from "drizzle-orm";

import { orderItems, orders, productionJobs } from "@aks/db";
import { consumeFabricAtCutting } from "@/modules/inventory";
import type { TransitionActor } from "@/modules/platform/transition";
import type { DbTx } from "@/modules/platform/types";

import { ProductionCuttingGateError } from "./transitions";

/** Gate + fabric consume when a job enters the cutting stage. */
export async function enterCuttingStage(
  orderId: string,
  actor: TransitionActor,
  tx: DbTx,
): Promise<void> {
  const [order] = await tx
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error("Order not found.");

  if (order.status !== "MEASUREMENTS_CONFIRMED") {
    const allowed = new Set([
      "CUTTING",
      "STITCHING",
      "EMBROIDERY",
      "FINISHING",
      "QUALITY_CHECK",
      "READY_TO_SHIP",
    ]);
    if (!allowed.has(order.status)) {
      throw new ProductionCuttingGateError();
    }
    return;
  }

  await consumeFabricAtCutting({ orderId, actor }, tx);
}

export async function orderIdForJob(jobId: string, tx: DbTx): Promise<string> {
  const [row] = await tx
    .select({ orderId: orders.id })
    .from(productionJobs)
    .innerJoin(orderItems, eq(productionJobs.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(productionJobs.id, jobId))
    .limit(1);

  if (!row) throw new Error("Production job not found.");
  return row.orderId;
}
