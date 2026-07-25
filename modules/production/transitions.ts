import { and, eq } from "drizzle-orm";

import {
  orderItems,
  orders,
  productionJobEvents,
  productionJobs,
} from "@aks/db";

import {
  IllegalTransitionError,
  registerEntityTransitions,
} from "@/modules/platform/transition";
import type { DbTx } from "@/modules/platform/types";

import {
  PRODUCTION_STAGE_ALLOW,
  type ProductionJobStage,
} from "./constants";
import { orderItemRequiresEmbroidery } from "./embroidery";
import { syncOrderStatusForJobStage } from "./sync-order";

let registered = false;

export class ProductionCuttingGateError extends Error {
  readonly code = "PRODUCTION_CUTTING_GATE" as const;

  constructor(
    message = "Cutting cannot begin until measurements are confirmed.",
  ) {
    super(message);
    this.name = "ProductionCuttingGateError";
  }
}

async function orderContextForJob(jobId: string, tx: DbTx) {
  const [row] = await tx
    .select({
      orderId: orders.id,
      orderStatus: orders.status,
      orderItemId: productionJobs.orderItemId,
    })
    .from(productionJobs)
    .innerJoin(orderItems, eq(productionJobs.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(productionJobs.id, jobId))
    .limit(1);

  if (!row) throw new Error("Production job not found.");
  return row;
}

export function registerProductionJobTransitions(): void {
  if (registered) return;
  registered = true;

  registerEntityTransitions("production_job", {
    applyStatusChange: async (tx, id, from, to) => {
      const toStage = to as ProductionJobStage;
      const fromStage = from as ProductionJobStage;
      const ctx = await orderContextForJob(id, tx);

      if (toStage === "CUTTING" && ctx.orderStatus !== "MEASUREMENTS_CONFIRMED") {
        const allowed = new Set([
          "CUTTING",
          "STITCHING",
          "EMBROIDERY",
          "FINISHING",
          "QUALITY_CHECK",
          "READY_TO_SHIP",
        ]);
        if (!allowed.has(ctx.orderStatus)) {
          throw new ProductionCuttingGateError();
        }
      }

      if (toStage === "EMBROIDERY") {
        const requires = await orderItemRequiresEmbroidery(ctx.orderItemId, tx);
        if (!requires) {
          throw new IllegalTransitionError("production_job", from, to);
        }
      }

      const patch: {
        stage: ProductionJobStage;
        updatedAt: Date;
        status: "PENDING" | "IN_PROGRESS" | "DONE";
        startedAt?: Date;
        completedAt?: Date | null;
      } = {
        stage: toStage,
        updatedAt: new Date(),
        status: toStage === "PACKED" ? "DONE" : "IN_PROGRESS",
      };

      if (toStage !== "PACKED") {
        patch.startedAt = new Date();
        patch.completedAt = null;
      } else {
        patch.completedAt = new Date();
      }

      const rows = await tx
        .update(productionJobs)
        .set(patch)
        .where(
          and(
            eq(productionJobs.id, id),
            eq(productionJobs.stage, fromStage),
          ),
        )
        .returning({ id: productionJobs.id });

      if (rows.length === 1) {
        await syncOrderStatusForJobStage(ctx.orderId, toStage, tx);
      }

      return rows.length;
    },
    insertEvent: async (tx, row) => {
      await tx.insert(productionJobEvents).values({
        id: row.id,
        jobId: row.entityId,
        fromStage: row.fromStatus as ProductionJobStage,
        toStage: row.toStatus as ProductionJobStage,
        actorId: row.actorId,
        note: row.note,
      });
    },
  });
}

registerProductionJobTransitions();

export { PRODUCTION_STAGE_ALLOW as PRODUCTION_JOB_TRANSITION_ALLOW };
