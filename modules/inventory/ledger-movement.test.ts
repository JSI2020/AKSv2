import { describe, expect, it } from "vitest";

import { deltaFromMovementType } from "./ledger-types";

/** Same rule as applyUnitMovement: new on-hand = current + delta (never below 0 in UI checks). */
function recomputeOnHand(current: number, delta: number): number {
  return current + delta;
}

describe("deltaFromMovementType", () => {
  it("Received is positive", () => {
    expect(deltaFromMovementType("RECEIVED", 10)).toBe(10);
  });

  it("Sold offline and damage are negative", () => {
    expect(deltaFromMovementType("SOLD_OFFLINE", 3)).toBe(-3);
    expect(deltaFromMovementType("DAMAGE", 2)).toBe(-2);
  });

  it("rejects non-positive quantity", () => {
    expect(() => deltaFromMovementType("RECEIVED", 0)).toThrow();
    expect(() => deltaFromMovementType("RECEIVED", 1.5)).toThrow();
  });
});

describe("movement → on-hand recompute (RTW / packing / trim)", () => {
  it("applies Received / Sold / Damage / correction in order", () => {
    let onHand = 0;
    onHand = recomputeOnHand(onHand, deltaFromMovementType("RECEIVED", 100));
    onHand = recomputeOnHand(onHand, deltaFromMovementType("SOLD_OFFLINE", 12));
    onHand = recomputeOnHand(onHand, deltaFromMovementType("DAMAGE", 3));
    onHand = recomputeOnHand(onHand, +5); // count correction +
    expect(onHand).toBe(90);
  });

  it("matches sum of movement deltas from zero", () => {
    const deltas = [
      deltaFromMovementType("RECEIVED", 40),
      deltaFromMovementType("SOLD_OFFLINE", 5),
      deltaFromMovementType("DAMAGE", 1),
      -2, // correction −
    ];
    expect(deltas.reduce((s, d) => s + d, 0)).toBe(32);
  });
});
