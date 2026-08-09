import { eq } from "drizzle-orm";

import { productionJobs } from "@aks/db";

import { transition, type TransitionActor } from "@/modules/platform/transition";
import type { DbTx } from "@/modules/platform/types";

import {
  PRODUCTION_JOB_STATUS_ALLOW,
  PRODUCTION_STAGE_ALLOW,
  type ProductionJobStage,
  type ProductionJobStatus,
} from "./constants";
import { orderItemRequiresEmbroidery } from "./embroidery";

export async function resolveNextJobStage(
  jobId: string,
  from: ProductionJobStage,
  tx: DbTx,
): Promise<ProductionJobStage | null> {
  const allowed = PRODUCTION_STAGE_ALLOW[from] ?? [];
  if (allowed.length === 0) return null;

  if (from === "STITCHING") {
    const [job] = await tx
      .select({ orderItemId: productionJobs.orderItemId })
      .from(productionJobs)
      .where(eq(productionJobs.id, jobId))
      .limit(1);

    if (!job) return null;

    const requiresEmbroidery = await orderItemRequiresEmbroidery(
      job.orderItemId,
      tx,
    );
    return requiresEmbroidery ? "EMBROIDERY" : "FINISHING";
  }

  return allowed[0] ?? null;
}

export async function transitionProductionJob(input: {
  jobId: string;
  from: ProductionJobStage;
  to: ProductionJobStage;
  actor: TransitionActor;
  note?: string;
  tx: DbTx;
}): Promise<void> {
  await transition({
    entity: "production_job",
    id: input.jobId,
    from: input.from,
    to: input.to,
    actor: input.actor,
    note: input.note,
    allowList: PRODUCTION_STAGE_ALLOW,
    tx: input.tx,
  });
}

export async function transitionProductionJobStatus(input: {
  jobId: string;
  from: ProductionJobStatus;
  to: ProductionJobStatus;
  actor: TransitionActor;
  note?: string;
  tx: DbTx;
}): Promise<void> {
  await transition({
    entity: "production_job_status",
    id: input.jobId,
    from: input.from,
    to: input.to,
    actor: input.actor,
    note: input.note,
    allowList: PRODUCTION_JOB_STATUS_ALLOW,
    tx: input.tx,
  });
}
