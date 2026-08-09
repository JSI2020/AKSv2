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
  type ProductionJobStatus,
} from "./constants";
import { enterCuttingStage } from "./cutting";
import { orderItemRequiresEmbroidery } from "./embroidery";
import { syncOrderStatusForJobStage } from "./sync-order";

const SYSTEM_ACTOR = {
  id: "00000000-0000-7000-8000-000000000002",
  role: "SYSTEM",
};

let registered = false;
let statusRegistered = false;

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

      // First leave from the cutting column: consume reservation + order → CUTTING.
      let orderStatus = ctx.orderStatus;
      if (
        fromStage === "CUTTING" &&
        toStage !== "CUTTING" &&
        orderStatus === "MEASUREMENTS_CONFIRMED"
      ) {
        await enterCuttingStage(ctx.orderId, SYSTEM_ACTOR, tx);
        await syncOrderStatusForJobStage(ctx.orderId, "CUTTING", tx);
        orderStatus = "CUTTING";
      }

      if (toStage === "CUTTING" && orderStatus === "MEASUREMENTS_CONFIRMED") {
        await enterCuttingStage(ctx.orderId, SYSTEM_ACTOR, tx);
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

/**
 * Workflow status (PENDING / IN_PROGRESS / BLOCKED / DONE) — distinct from
 * stage transitions. Events keep the current stage (unchanged) and record
 * the status change in the note.
 */
export function registerProductionJobStatusTransitions(): void {
  if (statusRegistered) return;
  statusRegistered = true;

  registerEntityTransitions("production_job_status", {
    applyStatusChange: async (tx, id, from, to) => {
      const toStatus = to as ProductionJobStatus;
      const fromStatus = from as ProductionJobStatus;

      const patch: {
        status: ProductionJobStatus;
        updatedAt: Date;
        blockedReason?: string | null;
        completedAt?: Date | null;
      } = {
        status: toStatus,
        updatedAt: new Date(),
      };

      if (toStatus === "BLOCKED") {
        patch.blockedReason = "Blocked";
      } else if (fromStatus === "BLOCKED") {
        patch.blockedReason = null;
      }

      if (toStatus === "DONE") {
        patch.completedAt = new Date();
      }

      const rows = await tx
        .update(productionJobs)
        .set(patch)
        .where(
          and(
            eq(productionJobs.id, id),
            eq(productionJobs.status, fromStatus),
          ),
        )
        .returning({ id: productionJobs.id });

      return rows.length;
    },
    insertEvent: async (tx, row) => {
      const [job] = await tx
        .select({ stage: productionJobs.stage })
        .from(productionJobs)
        .where(eq(productionJobs.id, row.entityId))
        .limit(1);

      if (!job) throw new Error("Production job not found for status event.");

      const statusNote = `status:${row.fromStatus}→${row.toStatus}`;
      await tx.insert(productionJobEvents).values({
        id: row.id,
        jobId: row.entityId,
        fromStage: job.stage,
        toStage: job.stage,
        actorId: row.actorId,
        note: row.note ? `${statusNote} — ${row.note}` : statusNote,
      });
    },
  });
}

registerProductionJobStatusTransitions();

export { PRODUCTION_STAGE_ALLOW as PRODUCTION_JOB_TRANSITION_ALLOW };
