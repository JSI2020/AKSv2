import { describe, expect, it } from "vitest";

import { DESIGN_STATUS_ALLOW } from "@aks/shared";

describe("DESIGN_STATUS_ALLOW angles stage", () => {
  it("allows sizing locked to start angle generation", () => {
    expect(DESIGN_STATUS_ALLOW.SIZING_LOCKED).toContain("ANGLES_GENERATING");
  });

  it("allows angles generating to enter review", () => {
    expect(DESIGN_STATUS_ALLOW.ANGLES_GENERATING).toContain("ANGLES_REVIEW");
  });

  it("allows review ↔ regenerate cycles and lock", () => {
    expect(DESIGN_STATUS_ALLOW.ANGLES_REVIEW).toContain("ANGLES_GENERATING");
    expect(DESIGN_STATUS_ALLOW.ANGLES_REVIEW).toContain("ANGLES_LOCKED");
  });

  it("allows locked angles to proceed to colourways", () => {
    expect(DESIGN_STATUS_ALLOW.ANGLES_LOCKED).toContain(
      "COLOURWAYS_GENERATING",
    );
  });
});

describe("angle sketch role mapping", () => {
  const SKETCH_ROLE_BY_ANGLE = {
    THREE_QUARTER: "SKETCH_SIDE",
    BACK: "SKETCH_BACK",
  } as const;

  it("maps back angle to back sketch", () => {
    expect(SKETCH_ROLE_BY_ANGLE.BACK).toBe("SKETCH_BACK");
  });

  it("maps three-quarter angle to side sketch", () => {
    expect(SKETCH_ROLE_BY_ANGLE.THREE_QUARTER).toBe("SKETCH_SIDE");
  });

  it("labels sketch vs interpolated sources", () => {
    expect("back: from your sketch").toContain("from your sketch");
    expect("back: interpolated").toContain("interpolated");
    expect("three-quarter: from your sketch").toContain("three-quarter");
  });
});
