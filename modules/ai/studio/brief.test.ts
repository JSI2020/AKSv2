import { describe, expect, it } from "vitest";

import {
  formatDesignBriefName,
  nextDesignBriefSeq,
  parseDesignBriefName,
} from "./brief-name";
import {
  briefReadyToSave,
  buildBriefChecklist,
  firstIncompleteHint,
} from "./brief-checklist";

describe("brief-name", () => {
  it("formats category-year-seq names", () => {
    expect(formatDesignBriefName("kameez", 2026, 14)).toBe("KAMEEZ-2026-014");
  });

  it("parses valid names", () => {
    expect(parseDesignBriefName("KAMEEZ-2026-014")).toEqual({
      categoryKey: "KAMEEZ",
      year: 2026,
      seq: 14,
    });
  });

  it("computes next sequence from existing names", () => {
    const seq = nextDesignBriefSeq(
      ["KAMEEZ-2026-001", "KAMEEZ-2026-014", "GOWN-2026-002"],
      "KAMEEZ",
      2026,
    );
    expect(seq).toBe(15);
  });
});

describe("brief-checklist", () => {
  const complete = {
    fabricId: "f1",
    colourwayName: "Ivory",
    garmentTypeId: "c1",
    archetypeId: "a1",
    garmentDescription: "Two-piece shalwar kameez.",
    shirtFabric: "Cotton lawn",
    shirtColour: "Ivory",
  };

  it("blocks save until required fields are present", () => {
    const items = buildBriefChecklist({ ...complete, fabricId: "" });
    expect(briefReadyToSave(items)).toBe(false);
    expect(firstIncompleteHint(items)).toBe("Pick a fabric to continue");
  });

  it("allows save when required fields are complete", () => {
    const items = buildBriefChecklist(complete);
    expect(briefReadyToSave(items)).toBe(true);
  });
});
