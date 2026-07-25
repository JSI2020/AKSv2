import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  db,
  outbox,
  sql,
  transitionProbeEvents,
  transitionProbes,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  IllegalTransitionError,
  registerTransitionProbe,
  transition,
  type TransitionAllowList,
} from "./transition";

const ALLOW: TransitionAllowList = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["ARCHIVED"],
  ARCHIVED: [],
};

const ACTOR = { id: "01900000-0000-7000-8000-0000000000aa", role: "OWNER" };

describe("transition()", () => {
  beforeAll(() => {
    registerTransitionProbe();
  });

  beforeEach(async () => {
    await db.delete(transitionProbeEvents);
    await db.delete(outbox);
    await db.delete(transitionProbes);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("legal transition succeeds and writes exactly one event", async () => {
    const id = uuidv7();
    await db.insert(transitionProbes).values({ id, status: "DRAFT" });

    await db.transaction(async (tx) => {
      await transition({
        entity: "transition_probe",
        id,
        from: "DRAFT",
        to: "ACTIVE",
        actor: ACTOR,
        note: "activate",
        allowList: ALLOW,
        tx,
      });
    });

    const probes = await db
      .select()
      .from(transitionProbes)
      .where(eq(transitionProbes.id, id));
    expect(probes).toHaveLength(1);
    expect(probes[0]?.status).toBe("ACTIVE");

    const events = await db
      .select()
      .from(transitionProbeEvents)
      .where(eq(transitionProbeEvents.entityId, id));
    expect(events).toHaveLength(1);
    expect(events[0]?.fromStatus).toBe("DRAFT");
    expect(events[0]?.toStatus).toBe("ACTIVE");
    expect(events[0]?.note).toBe("activate");

    const messages = await db
      .select()
      .from(outbox)
      .where(eq(outbox.topic, "transition_probe.transitioned"));
    expect(messages).toHaveLength(1);
    expect(messages[0]?.status).toBe("PENDING");
  });

  it("illegal transition throws and writes nothing", async () => {
    const id = uuidv7();
    await db.insert(transitionProbes).values({ id, status: "DRAFT" });

    await expect(
      db.transaction(async (tx) => {
        await transition({
          entity: "transition_probe",
          id,
          from: "DRAFT",
          to: "ARCHIVED",
          actor: ACTOR,
          allowList: ALLOW,
          tx,
        });
      }),
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    const probes = await db
      .select()
      .from(transitionProbes)
      .where(eq(transitionProbes.id, id));
    expect(probes[0]?.status).toBe("DRAFT");

    const events = await db
      .select()
      .from(transitionProbeEvents)
      .where(eq(transitionProbeEvents.entityId, id));
    expect(events).toHaveLength(0);

    const messages = await db.select().from(outbox);
    expect(messages).toHaveLength(0);
  });

  it("failure inside the transaction rolls back status change and event", async () => {
    const id = uuidv7();
    await db.insert(transitionProbes).values({ id, status: "DRAFT" });

    await expect(
      db.transaction(async (tx) => {
        await transition({
          entity: "transition_probe",
          id,
          from: "DRAFT",
          to: "ACTIVE",
          actor: ACTOR,
          note: "will-rollback",
          allowList: ALLOW,
          tx,
        });
        throw new Error("forced failure after transition");
      }),
    ).rejects.toThrow(/forced failure/);

    const probes = await db
      .select()
      .from(transitionProbes)
      .where(eq(transitionProbes.id, id));
    expect(probes[0]?.status).toBe("DRAFT");

    const events = await db
      .select()
      .from(transitionProbeEvents)
      .where(eq(transitionProbeEvents.entityId, id));
    expect(events).toHaveLength(0);

    const messages = await db.select().from(outbox);
    expect(messages).toHaveLength(0);
  });
});
