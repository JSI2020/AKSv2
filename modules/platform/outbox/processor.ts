import { and, eq, lte, sql } from "drizzle-orm";

import { db, outbox } from "@aks/db";

import { getHandler } from "./handlers";

const MAX_ATTEMPTS = 5;

/** Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped). */
export function backoffMs(attemptsAfterFailure: number): number {
  return Math.min(60_000, 1000 * 2 ** (attemptsAfterFailure - 1));
}

export type ProcessResult =
  | { kind: "idle" }
  | { kind: "sent"; id: string; topic: string }
  | { kind: "retry"; id: string; topic: string; attempts: number; delayMs: number }
  | { kind: "dead"; id: string; topic: string; attempts: number }
  | { kind: "missing-handler"; id: string; topic: string };

/**
 * Claim one due PENDING row, dispatch, mark SENT / retry / DEAD.
 */
export async function processOneOutboxMessage(): Promise<ProcessResult> {
  return db.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(outbox)
      .where(
        and(
          eq(outbox.status, "PENDING"),
          lte(outbox.availableAt, sql`now()`),
        ),
      )
      .orderBy(outbox.availableAt)
      .limit(1)
      .for("update", { skipLocked: true });

    const row = due[0];
    if (!row) return { kind: "idle" };

    const handler = getHandler(row.topic);
    if (!handler) {
      const attempts = row.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await tx
          .update(outbox)
          .set({
            status: "DEAD",
            attempts,
            lastError: `No handler registered for topic "${row.topic}"`,
            updatedAt: new Date(),
          })
          .where(eq(outbox.id, row.id));
        return {
          kind: "dead",
          id: row.id,
          topic: row.topic,
          attempts,
        };
      }
      const delay = backoffMs(attempts);
      await tx
        .update(outbox)
        .set({
          attempts,
          lastError: `No handler registered for topic "${row.topic}"`,
          availableAt: new Date(Date.now() + delay),
          updatedAt: new Date(),
        })
        .where(eq(outbox.id, row.id));
      return {
        kind: "retry",
        id: row.id,
        topic: row.topic,
        attempts,
        delayMs: delay,
      };
    }

    try {
      const payload =
        typeof row.payload === "object" && row.payload !== null
          ? (row.payload as Record<string, unknown>)
          : {};
      await handler(payload);
      await tx
        .update(outbox)
        .set({
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(outbox.id, row.id));
      return { kind: "sent", id: row.id, topic: row.topic };
    } catch (err) {
      const attempts = row.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      if (attempts >= MAX_ATTEMPTS) {
        await tx
          .update(outbox)
          .set({
            status: "DEAD",
            attempts,
            lastError: message,
            updatedAt: new Date(),
          })
          .where(eq(outbox.id, row.id));
        return {
          kind: "dead",
          id: row.id,
          topic: row.topic,
          attempts,
        };
      }
      const delay = backoffMs(attempts);
      await tx
        .update(outbox)
        .set({
          attempts,
          lastError: message,
          availableAt: new Date(Date.now() + delay),
          updatedAt: new Date(),
        })
        .where(eq(outbox.id, row.id));
      return {
        kind: "retry",
        id: row.id,
        topic: row.topic,
        attempts,
        delayMs: delay,
      };
    }
  });
}

export async function drainDueMessages(
  max = 50,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  for (let i = 0; i < max; i++) {
    const result = await processOneOutboxMessage();
    if (result.kind === "idle") break;
    results.push(result);
  }
  return results;
}
