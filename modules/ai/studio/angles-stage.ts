import { and, eq, inArray, sql } from "drizzle-orm";

import { db, designGenerations, designs } from "@aks/db";
import type { DesignStatus } from "@aks/shared";

import { transitionDesignStatus } from "@/modules/designs/studio-pipeline";
import type { DbTx } from "@/modules/platform/types";

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000001";

/** When no ANGLE jobs remain pending, move ANGLES_GENERATING → ANGLES_REVIEW. */
export async function maybeTransitionToAnglesReview(
  designId: string,
  tx?: DbTx,
): Promise<void> {
  const runner = tx ?? db;

  const [design] = await runner
    .select({ status: designs.status })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);

  const status = design?.status as DesignStatus | undefined;
  if (status !== "ANGLES_GENERATING") return;

  const [pending] = await runner
    .select({ n: sql<number>`count(*)::int` })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "ANGLE"),
        inArray(designGenerations.status, ["PENDING", "RUNNING"]),
      ),
    );

  if ((pending?.n ?? 0) > 0) return;

  const [generated] = await runner
    .select({ n: sql<number>`count(*)::int` })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "ANGLE"),
      ),
    );

  if ((generated?.n ?? 0) === 0) return;

  const write = async (inner: DbTx) => {
    await transitionDesignStatus({
      designId,
      from: "ANGLES_GENERATING",
      to: "ANGLES_REVIEW",
      actorId: SYSTEM_ACTOR,
      note: "All angle generations finished",
      tx: inner,
    });
  };

  if (tx) {
    await write(tx);
  } else {
    await db.transaction(write);
  }
}
