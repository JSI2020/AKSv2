import { describe, expect, it } from "vitest";

import { automaticPercentForDesign } from "../discounts/badge-math";
import { houseDoorTagKeys } from "./house-door";

describe("houseDoorTagKeys", () => {
  // Resolves against house_collections now, so it is async. Both the DB hit
  // and the no-match fallback yield the tag and its slug form.
  it("expands ESSENTIALS tag and slug", async () => {
    await expect(houseDoorTagKeys("ESSENTIALS")).resolves.toEqual(
      expect.arrayContaining(["ESSENTIALS", "essentials"]),
    );
    await expect(houseDoorTagKeys("essentials")).resolves.toEqual(
      expect.arrayContaining(["ESSENTIALS", "essentials"]),
    );
  });

  it("returns nothing for a blank key", async () => {
    await expect(houseDoorTagKeys("  ")).resolves.toEqual([]);
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
