import { describe, expect, it } from "vitest";

import {
  assertCuttingGate,
  CUTTING_ENTRY_STATUS,
} from "./constants";
import { getNextProductionStage, buildProductionTimeline } from "./status";
import type { OrderStatus } from "./constants";

describe("production pipeline", () => {
  it("only allows cutting from measurements confirmed", () => {
    expect(() =>
      assertCuttingGate("DEPOSIT_PAID", "CUTTING"),
    ).toThrow(/measurements are confirmed/i);
    expect(() =>
      assertCuttingGate(CUTTING_ENTRY_STATUS, "CUTTING"),
    ).not.toThrow();
  });

  it("skips embroidery when flag is set", () => {
    expect(getNextProductionStage("STITCHING", true)).toBe("FINISHING");
    expect(getNextProductionStage("STITCHING", false)).toBe("EMBROIDERY");
  });

  it("builds a step timeline without embroidery when skipped", () => {
    const timeline = buildProductionTimeline({
      currentStatus: "STITCHING",
      skipEmbroidery: true,
    });
    expect(timeline.some((s) => s.key === "EMBROIDERY")).toBe(false);
    expect(timeline.find((s) => s.key === "STITCHING")?.state).toBe("current");
  });

  it("walks the full production path", () => {
    let status: OrderStatus = "MEASUREMENTS_CONFIRMED";
    const path: string[] = [];
    for (let i = 0; i < 12; i++) {
      const next = getNextProductionStage(status, true);
      if (!next) break;
      path.push(next);
      status = next;
    }
    expect(path).toEqual([
      "CUTTING",
      "STITCHING",
      "FINISHING",
      "QUALITY_CHECK",
      "READY_TO_SHIP",
      "DISPATCHED",
      "DELIVERED",
      "COMPLETED",
    ]);
  });
});
