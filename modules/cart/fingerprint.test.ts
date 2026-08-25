import { describe, expect, it } from "vitest";

import { cartLineFingerprint } from "./types";

describe("cartLineFingerprint", () => {
  it("trims size labels and treats empty customization as equal", () => {
    const a = cartLineFingerprint({
      designId: "d1",
      colourwayId: "c1",
      sizeMode: "STANDARD",
      sizeLabel: " M ",
      measurementProfileId: null,
      customizationSelections: {},
    });
    const b = cartLineFingerprint({
      designId: "d1",
      colourwayId: "c1",
      sizeMode: "STANDARD",
      sizeLabel: "M",
      measurementProfileId: null,
      customizationSelections: {},
    });
    expect(a).toBe(b);
  });

  it("ignores measurement profiles for standard sizes", () => {
    const a = cartLineFingerprint({
      designId: "d1",
      colourwayId: "c1",
      sizeMode: "STANDARD",
      sizeLabel: "M",
      measurementProfileId: "profile-a",
      customizationSelections: {},
    });
    const b = cartLineFingerprint({
      designId: "d1",
      colourwayId: "c1",
      sizeMode: "STANDARD",
      sizeLabel: "M",
      measurementProfileId: null,
      customizationSelections: {},
    });
    expect(a).toBe(b);
  });
});
