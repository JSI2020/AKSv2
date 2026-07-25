import { describe, expect, it } from "vitest";

import { inferPromptProfileOrigin } from "./infer-origin";
import { buildInputSummary } from "./input-summary";
import { inferRoleFromFilename } from "./input-roles";

describe("inferPromptProfileOrigin", () => {
  it("prefers sketch-led when front sketch present", () => {
    expect(inferPromptProfileOrigin(["SKETCH_FRONT"])).toBe("SKETCH_LED");
  });

  it("uses reference-led when no sketch but references exist", () => {
    expect(inferPromptProfileOrigin(["REFERENCE_OWN", "FABRIC_SWATCH"])).toBe(
      "REFERENCE_LED",
    );
  });

  it("uses fabric-led when only fabric swatch", () => {
    expect(inferPromptProfileOrigin(["FABRIC_SWATCH"])).toBe("FABRIC_LED");
  });
});

describe("buildInputSummary", () => {
  it("describes multi-sketch set with back angle note", () => {
    const summary = buildInputSummary([
      { role: "SKETCH_FRONT" },
      { role: "SKETCH_BACK" },
      { role: "SKETCH_DETAIL" },
      { role: "SKETCH_DETAIL" },
      { role: "FABRIC_SWATCH" },
    ]);
    expect(summary).toContain("1 front sketch");
    expect(summary).toContain("1 back sketch");
    expect(summary).toContain("2 details");
    expect(summary).toContain("1 fabric");
    expect(summary).toContain("back angle will follow your back sketch");
  });

  it("handles empty input set", () => {
    expect(buildInputSummary([])).toMatch(/drop/i);
  });
});

describe("inferRoleFromFilename", () => {
  it("guesses roles from filename tokens", () => {
    expect(inferRoleFromFilename("kameez-front-scan.jpg")).toBe("SKETCH_FRONT");
    expect(inferRoleFromFilename("design_back.png")).toBe("SKETCH_BACK");
    expect(inferRoleFromFilename("mood-ref-inspo.jpg")).toBe("REFERENCE_EXTERNAL");
    expect(inferRoleFromFilename("cotton-swatch.jpg")).toBe("FABRIC_SWATCH");
  });
});
