import { and, desc, eq, inArray } from "drizzle-orm";

import { formatActionError } from "@/modules/platform/action-error";

import { db, designGenerations } from "@aks/db";
import type { RenderAngle } from "@aks/shared";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process queued COLOURWAY jobs inline so Photos tab works without a separate worker.
 * Worker can still process the same idempotent rows later.
 */
export async function processManualStudioGenerations(input: {
  designId: string;
  angles?: RenderAngle[];
  timeoutMs?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { handleDesignGenerate } = await import(
    "@/modules/ai/generation/handler"
  );
  const deadline = Date.now() + (input.timeoutMs ?? 180_000);
  const targetAngles = input.angles?.length ? input.angles : undefined;

  while (Date.now() < deadline) {
    const rows = await db
      .select()
      .from(designGenerations)
      .where(
        and(
          eq(designGenerations.designId, input.designId),
          eq(designGenerations.stage, "COLOURWAY"),
          inArray(designGenerations.status, ["PENDING", "RUNNING"]),
        ),
      )
      .orderBy(desc(designGenerations.createdAt));

    const pending = targetAngles
      ? rows.filter((r) =>
          targetAngles.includes(r.angle as RenderAngle),
        )
      : rows;

    if (pending.length === 0) break;

    for (const row of pending) {
      if (row.status !== "PENDING") continue;
      try {
        await handleDesignGenerate({ generationId: row.id });
      } catch (e) {
        return { ok: false, error: formatActionError(e) };
      }
    }

    await sleep(400);
  }

  const failed = await db
    .select({ error: designGenerations.error, angle: designGenerations.angle })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, input.designId),
        eq(designGenerations.stage, "COLOURWAY"),
        eq(designGenerations.status, "FAILED"),
      ),
    )
    .orderBy(desc(designGenerations.createdAt))
    .limit(1);

  if (failed[0]?.error) {
    return { ok: false, error: formatActionError(new Error(failed[0].error)) };
  }

  const stillPending = await db
    .select({ id: designGenerations.id })
    .from(designGenerations)
    .where(
      and(
        eq(designGenerations.designId, input.designId),
        eq(designGenerations.stage, "COLOURWAY"),
        inArray(designGenerations.status, ["PENDING", "RUNNING"]),
      ),
    )
    .limit(1);

  if (stillPending[0]) {
    return {
      ok: false,
      error:
        "Generation is still running. Start `npm run worker:dev` or wait and refresh.",
    };
  }

  return { ok: true };
}
