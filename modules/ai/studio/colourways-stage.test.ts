import { describe, expect, it } from "vitest";

import { DESIGN_STATUS_ALLOW } from "@aks/shared";

import { formatColourwayCostPreview } from "./colourway-prompt";

describe("DESIGN_STATUS_ALLOW colourways stage", () => {
  it("allows locked angles to skip to ready to publish", () => {
    expect(DESIGN_STATUS_ALLOW.ANGLES_LOCKED).toContain("READY_TO_PUBLISH");
  });

  it("allows colourways generating to enter review", () => {
    expect(DESIGN_STATUS_ALLOW.COLOURWAYS_GENERATING).toContain(
      "COLOURWAYS_REVIEW",
    );
  });

  it("allows review to proceed to publish", () => {
    expect(DESIGN_STATUS_ALLOW.COLOURWAYS_REVIEW).toContain(
      "READY_TO_PUBLISH",
    );
  });

  it("allows ready to publish to go live", () => {
    expect(DESIGN_STATUS_ALLOW.READY_TO_PUBLISH).toContain("PUBLISHED");
  });
});

describe("formatColourwayCostPreview", () => {
  it("formats the step 42 cost preview string", () => {
    expect(formatColourwayCostPreview(3)).toBe(
      "3 colourways × 3 angles = 9 images, ~$0.29.",
    );
  });

  it("uses singular colourway for one", () => {
    expect(formatColourwayCostPreview(1)).toMatch(/^1 colourway ×/);
  });
});
