import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, outbox, sql } from "@aks/db";

import {
  backoffMs,
  enqueue,
  processOneOutboxMessage,
  registerHandler,
  registerTestPingHandler,
} from "./index";

describe("outbox worker", () => {
  beforeEach(async () => {
    await db.delete(outbox);
    registerTestPingHandler();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("enqueueing test.ping results in a SENT row", async () => {
    await db.transaction(async (tx) => {
      await enqueue("test.ping", { n: 1 }, tx);
    });

    const result = await processOneOutboxMessage();
    expect(result.kind).toBe("sent");

    const rows = await db.select().from(outbox);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("SENT");
    expect(rows[0]?.topic).toBe("test.ping");
    expect(rows[0]?.sentAt).toBeTruthy();
  });

  it("throwing handler retries with increasing delay and dead-letters after 5", async () => {
    registerHandler("test.fail", async () => {
      throw new Error("boom");
    });

    await db.transaction(async (tx) => {
      await enqueue("test.fail", {}, tx);
    });

    const delays: number[] = [];

    for (let i = 1; i <= 4; i++) {
      // Make row due now regardless of prior backoff.
      await db
        .update(outbox)
        .set({ availableAt: new Date(0) })
        .where(eq(outbox.topic, "test.fail"));

      const result = await processOneOutboxMessage();
      expect(result.kind).toBe("retry");
      if (result.kind === "retry") {
        expect(result.attempts).toBe(i);
        expect(result.delayMs).toBe(backoffMs(i));
        delays.push(result.delayMs);
      }
    }

    expect(delays).toEqual([1000, 2000, 4000, 8000]);

    await db
      .update(outbox)
      .set({ availableAt: new Date(0) })
      .where(eq(outbox.topic, "test.fail"));

    const dead = await processOneOutboxMessage();
    expect(dead.kind).toBe("dead");
    if (dead.kind === "dead") {
      expect(dead.attempts).toBe(5);
    }

    const rows = await db.select().from(outbox);
    expect(rows[0]?.status).toBe("DEAD");
    expect(rows[0]?.attempts).toBe(5);
    expect(rows[0]?.lastError).toContain("boom");
  });
});

describe("backoffMs", () => {
  it("grows exponentially", () => {
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(3)).toBe(4000);
    expect(backoffMs(4)).toBe(8000);
    expect(backoffMs(5)).toBe(16000);
  });
});
