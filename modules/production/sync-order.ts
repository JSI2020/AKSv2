import { eq } from "drizzle-orm";

import { orderItems, orders, productionJobs } from "@aks/db";
import type { DbTx } from "@/modules/platform/types";

import { transitionOrder } from "@/modules/orders/transition-order";
import type { OrderStatus } from "@/modules/orders/constants";

import type { ProductionJobStage } from "./constants";

const JOB_STAGE_TO_ORDER_STATUS: Partial<
  Record<ProductionJobStage, OrderStatus>
> = {
  CUTTING: "CUTTING",
  STITCHING: "STITCHING",
  EMBROIDERY: "EMBROIDERY",
  FINISHING: "FINISHING",
  QC: "QUALITY_CHECK",
  PACKED: "READY_TO_SHIP",
};

const ORDER_STATUS_RANK: Record<string, number> = {
  MEASUREMENTS_CONFIRMED: 10,
  CUTTING: 20,
  STITCHING: 30,
  EMBROIDERY: 35,
  FINISHING: 40,
  QUALITY_CHECK: 50,
  READY_TO_SHIP: 60,
};

/** Advance parent order status when a job reaches a new stage. */
export async function syncOrderStatusForJobStage(
  orderId: string,
  jobStage: ProductionJobStage,
  tx: DbTx,
  actor = { id: "00000000-0000-7000-8000-000000000001", role: "SYSTEM" },
): Promise<void> {
  const target = JOB_STAGE_TO_ORDER_STATUS[jobStage];
  if (!target) return;

  const [order] = await tx
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const currentRank = ORDER_STATUS_RANK[order.status] ?? 0;
  const targetRank = ORDER_STATUS_RANK[target] ?? 0;
  if (targetRank <= currentRank) return;

  if (jobStage === "PACKED") {
    const items = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    for (const item of items) {
      const [job] = await tx
        .select({ stage: productionJobs.stage })
        .from(productionJobs)
        .where(eq(productionJobs.orderItemId, item.id))
        .limit(1);
      if (!job || job.stage !== "PACKED") return;
    }
  }

  await transitionOrder({
    orderId,
    from: order.status as OrderStatus,
    to: target,
    actor,
    tx,
  });
}
