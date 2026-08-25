import { describe, expect, it } from "vitest";

import { resolveTimeRange } from "./time-range";

describe("resolveTimeRange", () => {
  const now = new Date("2026-08-12T12:00:00+05:00");

  it("defaults to this month", () => {
    const r = resolveTimeRange({ now });
    expect(r.preset).toBe("month");
    expect(r.fromKey).toBe("2026-08-01");
    expect(r.toKey).toBe("2026-08-12");
  });

  it("resolves this quarter", () => {
    const r = resolveTimeRange({ preset: "quarter", now });
    expect(r.fromKey).toBe("2026-07-01");
    expect(r.toKey).toBe("2026-08-12");
  });

  it("resolves 7d inclusive", () => {
    const r = resolveTimeRange({ preset: "7d", now });
    expect(r.fromKey).toBe("2026-08-06");
    expect(r.toKey).toBe("2026-08-12");
  });

  it("swaps custom from/to when inverted", () => {
    const r = resolveTimeRange({
      preset: "custom",
      fromKey: "2026-08-20",
      toKey: "2026-08-01",
      now,
    });
    expect(r.fromKey).toBe("2026-08-01");
    expect(r.toKey).toBe("2026-08-20");
  });
});
