import { and, eq } from "drizzle-orm";

import { db, designLocks, designs } from "@aks/db";
import {
  DESIGN_STATUS_ALLOW,
  POST_HERO_LOCKED_STATUSES,
  type DesignStatus,
} from "@aks/shared";

import { transition } from "@/modules/platform/transition";
import type { DbTx } from "@/modules/platform/types";

export { DESIGN_STATUS_ALLOW as DESIGN_PIPELINE_ALLOW };

export class DesignPipelineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DesignPipelineError";
    this.code = code;
  }
}

export async function getDesignPipelineStatus(
  designId: string,
): Promise<DesignStatus | null> {
  const [row] = await db
    .select({ status: designs.status })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  return (row?.status as DesignStatus | undefined) ?? null;
}

export async function transitionDesignStatus(
  input: {
    designId: string;
    from: DesignStatus;
    to: DesignStatus;
    actorId: string;
    actorRole?: string;
    note?: string;
    tx: DbTx;
  },
): Promise<void> {
  await transition({
    entity: "design",
    id: input.designId,
    from: input.from,
    to: input.to,
    actor: { id: input.actorId, role: input.actorRole },
    note: input.note,
    allowList: DESIGN_STATUS_ALLOW,
    tx: input.tx,
  });
}

export async function hasHeroLock(designId: string): Promise<boolean> {
  const [row] = await db
    .select({ designId: designLocks.designId })
    .from(designLocks)
    .where(
      and(eq(designLocks.designId, designId), eq(designLocks.stage, "HERO")),
    )
    .limit(1);
  return Boolean(row);
}

/** Enforced before ANGLE / COLOURWAY jobs — no downstream work on an unlocked hero. */
export async function assertHeroLockedForDownstream(
  designId: string,
  stage: "HERO" | "ANGLE" | "COLOURWAY",
): Promise<void> {
  if (stage === "HERO") return;

  const locked = await hasHeroLock(designId);
  if (!locked) {
    throw new DesignPipelineError(
      "HERO_NOT_LOCKED",
      "Hero must be approved and locked before running downstream generation.",
    );
  }

  const status = await getDesignPipelineStatus(designId);
  if (
    !status ||
    !(POST_HERO_LOCKED_STATUSES as readonly string[]).includes(status)
  ) {
    throw new DesignPipelineError(
      "HERO_NOT_LOCKED",
      `Design status "${status ?? "unknown"}" does not permit downstream generation.`,
    );
  }
}

export function canEnqueueHeroGeneration(status: DesignStatus): boolean {
  return status === "INPUTS_UPLOADED" || status === "HERO_REVIEW";
}

export function heroReviewStatuses(): DesignStatus[] {
  return ["HERO_REVIEW", "HERO_LOCKED", "HERO_GENERATING"];
}
