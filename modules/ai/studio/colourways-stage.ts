import { and, eq, inArray, sql } from "drizzle-orm";

import { db, designGenerations, designs } from "@aks/db";
import type { DesignStatus } from "@aks/shared";

import { transitionDesignStatus } from "@/modules/designs/studio-pipeline";
import type { DbTx } from "@/modules/platform/types";

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000001";

/** When no COLOURWAY jobs remain pending, move COLOURWAYS_GENERATING → COLOURWAYS_REVIEW. */
export async function maybeTransitionToColourwaysReview(
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
  if (status !== "COLOURWAYS_GENERATING") return;

  const [pending] = await runner
    .select({ n: sql<number>`count(*)::int` })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, designId),
        eq(designGenerations.stage, "COLOURWAY"),
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
        eq(designGenerations.stage, "COLOURWAY"),
      ),
    );

  if ((generated?.n ?? 0) === 0) return;

  const write = async (inner: DbTx) => {
    await transitionDesignStatus({
      designId,
      from: "COLOURWAYS_GENERATING",
      to: "COLOURWAYS_REVIEW",
      actorId: SYSTEM_ACTOR,
      note: "All colourway generations finished",
      tx: inner,
    });
  };

  if (tx) {
    await write(tx);
  } else {
    await db.transaction(write);
  }
}
