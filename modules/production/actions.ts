"use server";

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  db,
  insertAuditLog,
  orderItems,
  orders,
  productionJobs,
  qcChecks,
  reworkOrders,
  staff,
  type Database,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  clientIpFromHeaders,
  PermissionDeniedError,
  requirePermission,
} from "@/modules/auth";

import {
  PRODUCTION_JOB_STAGES,
  REWORK_RETURN_STAGE,
  reworkChargeCustomer,
  type ProductionJobStage,
  type ReworkFaultAttribution,
} from "./constants";
import { enterCuttingStage } from "./cutting";
import {
  resolveNextJobStage,
  transitionProductionJob,
  transitionProductionJobStatus,
} from "./transition-job";

import "./transitions";

async function auditContext() {
  const h = await headers();
  return {
    ip: clientIpFromHeaders(h),
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
  };
}

function actionError(error: unknown): { ok: false; error: string } {
  if (error instanceof PermissionDeniedError) {
    return { ok: false, error: "You do not have permission for this action." };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Something went wrong." };
}

export async function advanceProductionJobAction(input: {
  jobId: string;
  toStage?: ProductionJobStage;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("production.advance_stage");

    await db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          id: productionJobs.id,
          stage: productionJobs.stage,
          orderItemId: productionJobs.orderItemId,
        })
        .from(productionJobs)
        .where(eq(productionJobs.id, input.jobId))
        .limit(1);

      if (!job) throw new Error("Job not found.");

      const from = job.stage as ProductionJobStage;
      const to =
        input.toStage ??
        (await resolveNextJobStage(job.id, from, tx));

      if (!to) throw new Error(`No next stage from ${from}.`);

      const allowed = PRODUCTION_JOB_STAGES;
      if (!allowed.includes(to)) {
        throw new Error("Invalid stage.");
      }

      const [item] = await tx
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .where(eq(orderItems.id, job.orderItemId))
        .limit(1);

      if (!item) throw new Error("Order item not found.");

      if (to === "CUTTING") {
        await enterCuttingStage(
          item.orderId,
          { id: session.user.id, role: session.user.role },
          tx,
        );
      }

      await transitionProductionJob({
        jobId: job.id,
        from,
        to,
        actor: { id: session.user.id, role: session.user.role },
        note: input.note,
        tx,
      });

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "production.advance_stage",
        entityType: "production_job",
        entityId: job.id,
        before: { stage: from },
        after: { stage: to },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/production");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function assignProductionJobAction(input: {
  jobId: string;
  staffId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("production.assign");

    await db.transaction(async (tx) => {
      const [job] = await tx
        .select({ id: productionJobs.id, assignedToId: productionJobs.assignedToId })
        .from(productionJobs)
        .where(eq(productionJobs.id, input.jobId))
        .limit(1);

      if (!job) throw new Error("Job not found.");

      if (input.staffId) {
        const [karigar] = await tx
          .select({ id: staff.id, isActive: staff.isActive })
          .from(staff)
          .where(eq(staff.id, input.staffId))
          .limit(1);
        if (!karigar?.isActive) throw new Error("Karigar not found or inactive.");
      }

      await tx
        .update(productionJobs)
        .set({
          assignedToId: input.staffId,
          updatedAt: new Date(),
        })
        .where(eq(productionJobs.id, input.jobId));

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "production.assign",
        entityType: "production_job",
        entityId: input.jobId,
        before: { assignedToId: job.assignedToId },
        after: { assignedToId: input.staffId },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/production");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function blockProductionJobAction(input: {
  jobId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("production.advance_stage");
    const reason = input.reason.trim();
    if (!reason) return { ok: false, error: "Blocked reason is required." };

    await db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          id: productionJobs.id,
          status: productionJobs.status,
        })
        .from(productionJobs)
        .where(eq(productionJobs.id, input.jobId))
        .limit(1);

      if (!job) throw new Error("Production job not found.");

      await transitionProductionJobStatus({
        jobId: job.id,
        from: job.status,
        to: "BLOCKED",
        actor: { id: session.user.id, role: session.user.role },
        note: reason,
        tx,
      });

      await tx
        .update(productionJobs)
        .set({ blockedReason: reason, updatedAt: new Date() })
        .where(eq(productionJobs.id, job.id));
    });

    revalidatePath("/admin/production");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function recordQcCheckAction(input: {
  jobId: string;
  checklist: Record<string, "pass" | "fail">;
  result: "PASS" | "FAIL";
  faultAttribution?: ReworkFaultAttribution;
  reason?: string;
  costMinor?: number;
  photoAssetIds?: string[];
  notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("production.advance_stage");

    await db.transaction(async (tx) => {
      const [job] = await tx
        .select({
          id: productionJobs.id,
          stage: productionJobs.stage,
          orderItemId: productionJobs.orderItemId,
        })
        .from(productionJobs)
        .where(eq(productionJobs.id, input.jobId))
        .limit(1);

      if (!job) throw new Error("Job not found.");
      if (job.stage !== "QC") {
        throw new Error("QC checks can only be recorded at the QC stage.");
      }

      await tx.insert(qcChecks).values({
        id: uuidv7(),
        jobId: job.id,
        orderItemId: job.orderItemId,
        checklist: input.checklist,
        result: input.result,
        photoAssetIds: input.photoAssetIds ?? [],
        inspectorId: session.user.id,
        notes: input.notes,
      });

      if (input.result === "PASS") {
        await transitionProductionJob({
          jobId: job.id,
          from: "QC",
          to: "PACKED",
          actor: { id: session.user.id, role: session.user.role },
          tx,
        });
        return;
      }

      const fault = input.faultAttribution ?? "UNDETERMINED";
      const returnStage = REWORK_RETURN_STAGE[fault];

      await tx.insert(reworkOrders).values({
        id: uuidv7(),
        originalOrderItemId: job.orderItemId,
        originalJobId: job.id,
        reason: input.reason?.trim() || "QC failed",
        faultAttribution: fault,
        costMinor: input.costMinor ?? 0,
        chargeCustomer: reworkChargeCustomer(fault),
        status: "PENDING",
      });

      const [item] = await tx
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .where(eq(orderItems.id, job.orderItemId))
        .limit(1);

      if (returnStage === "CUTTING" && item) {
        await enterCuttingStage(
          item.orderId,
          { id: session.user.id, role: session.user.role },
          tx,
        );
      }

      await transitionProductionJob({
        jobId: job.id,
        from: "QC",
        to: returnStage,
        actor: { id: session.user.id, role: session.user.role },
        note: `QC fail — ${fault}`,
        tx,
      });
    });

    revalidatePath("/admin/production");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

import type { ProductionBoardFilters } from "./admin/search-params";

export async function listProductionBoardAction(
  filters: ProductionBoardFilters = {},
): Promise<
  | {
      ok: true;
      columns: Record<
        ProductionJobStage,
        import("./queries").ProductionBoardCard[]
      >;
      staff: import("./queries").StaffOption[];
      workload: import("./workload").StaffWorkloadRow[];
    }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("production.view");
    const { listProductionBoard, listActiveStaff } = await import("./queries");
    const { computeStaffWorkload } = await import("./workload");
    const [board, staffList, workload] = await Promise.all([
      listProductionBoard(filters),
      listActiveStaff(),
      computeStaffWorkload(),
    ]);
    return { ok: true, columns: board, staff: staffList, workload };
  } catch (error) {
    return actionError(error);
  }
}
