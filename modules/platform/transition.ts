import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@aks/db";
import { transitionProbeEvents, transitionProbes } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { enqueue } from "./outbox/enqueue";
import type { DbTx } from "./types";

export type TransitionActor = {
  id: string;
  role?: string;
};

/** from → allowed destination statuses */
export type TransitionAllowList = Readonly<
  Record<string, readonly string[]>
>;

export type TransitionTx = DbTx;

export class IllegalTransitionError extends Error {
  readonly code = "ILLEGAL_TRANSITION" as const;

  constructor(
    readonly entity: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`Illegal transition for ${entity}: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export type EntityTransitionHandlers = {
  applyStatusChange: (
    tx: TransitionTx,
    id: string,
    from: string,
    to: string,
  ) => Promise<number>;
  insertEvent: (
    tx: TransitionTx,
    row: {
      id: string;
      entityId: string;
      fromStatus: string;
      toStatus: string;
      actorId: string;
      note?: string;
    },
  ) => Promise<void>;
};

const registry = new Map<string, EntityTransitionHandlers>();

export function registerEntityTransitions(
  entity: string,
  handlers: EntityTransitionHandlers,
): void {
  registry.set(entity, handlers);
}

export type TransitionInput = {
  entity: string;
  id: string;
  from: string;
  to: string;
  actor: TransitionActor;
  note?: string;
  allowList: TransitionAllowList;
  tx: TransitionTx;
};

/**
 * Atomic status change: validate allow-list, update status, write *_events,
 * enqueue outbox — all in the caller's transaction.
 */
export async function transition(input: TransitionInput): Promise<void> {
  const { entity, id, from, to, actor, note, allowList, tx } = input;

  const allowed = allowList[from] ?? [];
  if (!allowed.includes(to)) {
    throw new IllegalTransitionError(entity, from, to);
  }

  const handlers = registry.get(entity);
  if (!handlers) {
    throw new Error(`No transition handlers registered for entity "${entity}"`);
  }

  const updated = await handlers.applyStatusChange(tx, id, from, to);
  if (updated !== 1) {
    throw new IllegalTransitionError(entity, from, to);
  }

  const eventId = uuidv7();
  await handlers.insertEvent(tx, {
    id: eventId,
    entityId: id,
    fromStatus: from,
    toStatus: to,
    actorId: actor.id,
    note,
  });

  await enqueue(
    `${entity}.transitioned`,
    {
      entity,
      id,
      from,
      to,
      actorId: actor.id,
      eventId,
      note: note ?? null,
    },
    tx,
  );
}

/** Built-in probe entity used by step 7 tests. */
export function registerTransitionProbe(): void {
  registerEntityTransitions("transition_probe", {
    async applyStatusChange(tx, id, from, to) {
      const rows = await tx
        .update(transitionProbes)
        .set({ status: to, updatedAt: sql`now()` })
        .where(
          and(eq(transitionProbes.id, id), eq(transitionProbes.status, from)),
        )
        .returning({ id: transitionProbes.id });
      return rows.length;
    },
    async insertEvent(tx, row) {
      await tx.insert(transitionProbeEvents).values(row);
    },
  });
}

export type { Database };
