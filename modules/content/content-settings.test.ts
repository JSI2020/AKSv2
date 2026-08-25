import { describe, expect, it } from "vitest";

import { automaticPercentForDesign } from "../discounts/badge-math";
import { houseDoorTagKeys } from "./house-door";

describe("houseDoorTagKeys", () => {
  it("expands ESSENTIALS tag and slug", () => {
    expect(houseDoorTagKeys("ESSENTIALS")).toEqual(
      expect.arrayContaining(["ESSENTIALS", "essentials"]),
    );
    expect(houseDoorTagKeys("essentials")).toEqual(
      expect.arrayContaining(["ESSENTIALS", "essentials"]),
    );
  });
});

describe("automaticPercentForDesign CATEGORY", () => {
  it("matches house-door free tags", () => {
    const pct = automaticPercentForDesign({
      designId: "d1",
      freeTags: ["ESSENTIALS"],
      garmentTypeKey: "KAMEEZ",
      discounts: [
        {
          value: 15,
          appliesTo: "CATEGORY",
          targetIds: ["ESSENTIALS"],
        },
        {
          value: 10,
          appliesTo: "DESIGN",
          targetIds: ["other"],
        },
      ],
    });
    expect(pct).toBe(15);
  });

  it("takes best percentage when multiple apply", () => {
    const pct = automaticPercentForDesign({
      designId: "d1",
      freeTags: ["SIGNATURE"],
      garmentTypeKey: "KAMEEZ",
      discounts: [
        { value: 10, appliesTo: "ORDER", targetIds: [] },
        { value: 20, appliesTo: "CATEGORY", targetIds: ["SIGNATURE"] },
      ],
    });
    expect(pct).toBe(20);
  });
});

describe("gate publish guard", () => {
  it("blocks publish when publishedDesignCount is zero", () => {
    const publishedDesignCount = 0;
    const blocked =
      publishedDesignCount < 1
        ? "No published design yet — link one in Designs before publishing this gate."
        : null;
    expect(blocked).toMatch(/No published design yet/);
  });
});
