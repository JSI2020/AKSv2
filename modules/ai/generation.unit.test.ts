import { describe, expect, it } from "vitest";

import { buildIdempotencyKey, parseIdempotencyKey } from "./generation/idempotency";
import { estimateCostUsdMicros } from "./providers/fal-models";

describe("generation idempotency keys", () => {
  it("builds stable keys with nullable angle and colourway", () => {
    expect(
      buildIdempotencyKey({
        designId: "design-1",
        stage: "HERO",
        angle: "front",
        attemptN: 1,
      }),
    ).toBe("design-1:HERO:front:_:1");

    expect(
      buildIdempotencyKey({
        designId: "design-1",
        stage: "COLOURWAY",
        colourwayId: "cw-1",
        attemptN: 2,
      }),
    ).toBe("design-1:COLOURWAY:_:cw-1:2");
  });

  it("round-trips through parseIdempotencyKey", () => {
    const key = buildIdempotencyKey({
      designId: "design-1",
      stage: "ANGLE",
      angle: "back",
      attemptN: 3,
    });
    expect(parseIdempotencyKey(key)).toEqual({
      designId: "design-1",
      stage: "ANGLE",
      angle: "back",
      colourwayId: "_",
      attemptN: 3,
    });
  });
});

describe("fal cost estimates", () => {
  it("uses verified per-MP pricing with megapixel rounding", () => {
    expect(estimateCostUsdMicros("hero", 512, 512)).toBe(75_000);
    expect(estimateCostUsdMicros("hero", 1024, 1024)).toBe(150_000);
    expect(estimateCostUsdMicros("colourway", 1024, 1024)).toBe(32_000);
    expect(estimateCostUsdMicros("draft", 512, 512)).toBe(30_000);
  });
});
