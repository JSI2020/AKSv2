import { describe, expect, it } from "vitest";

import { formatModelDisclosure, inches } from "@aks/shared";

describe("formatModelDisclosure", () => {
  it("renders the Regular archetype disclosure correctly", () => {
    expect(
      formatModelDisclosure({
        heightInches: inches(67),
        heightCm: 170,
        wearsSizeLabel: "M",
        bust: inches(36),
        waist: inches(28),
        hip: inches(38),
      }),
    ).toBe(
      "Model is 5'7″ (170 cm) and wears size M. Bust 36″ · Waist 28″ · Hip 38″",
    );
  });
});
