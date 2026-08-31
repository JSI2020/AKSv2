import { describe, expect, it } from "vitest";

import { evaluatePublishChecklist } from "./publish-checklist";

const baseDesign = {
  basePriceMinor: 500_000,
  fabricConsumptionMeters: 300,
  sizeBlockId: "block-1",
  fitProfileIds: { KAMEEZ: "fp-1" },
  components: ["KAMEEZ"],
};

describe("evaluatePublishChecklist", () => {
  it("blocks publish when size block has no rows", () => {
    const missing = evaluatePublishChecklist({
      design: baseDesign,
      colourways: [{ id: "cw-1", name: "Ivory" }],
      renders: [
        { colourwayId: "cw-1", angle: "FRONT", altText: "Front view" },
      ],
      tags: [{ kind: "OCCASION", value: "EVERYDAY" }],
      sizeBlockRowCount: 0,
    });
    expect(missing.some((m) => m.includes("measurement rows"))).toBe(true);
  });

  it("passes when size block has rows", () => {
    const missing = evaluatePublishChecklist({
      design: baseDesign,
      colourways: [{ id: "cw-1", name: "Ivory" }],
      renders: [
        { colourwayId: "cw-1", angle: "FRONT", altText: "Front view" },
      ],
      tags: [{ kind: "OCCASION", value: "EVERYDAY" }],
      sizeBlockRowCount: 3,
    });
    expect(missing).toEqual([]);
  });
});
