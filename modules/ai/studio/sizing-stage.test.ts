import { describe, expect, it } from "vitest";

import { DESIGN_STATUS_ALLOW } from "@aks/shared";

describe("DESIGN_STATUS_ALLOW sizing stage", () => {
  it("allows hero locked to enter sizing", () => {
    expect(DESIGN_STATUS_ALLOW.HERO_LOCKED).toContain("SIZING");
  });

  it("allows skip to sizing locked without angles", () => {
    expect(DESIGN_STATUS_ALLOW.SIZING).toContain("SIZING_LOCKED");
  });

  it("allows sizing locked to proceed to angles", () => {
    expect(DESIGN_STATUS_ALLOW.SIZING_LOCKED).toContain("ANGLES_GENERATING");
  });
});
