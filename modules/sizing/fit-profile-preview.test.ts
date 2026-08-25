import { describe, expect, it } from "vitest";

import { FIT_PROFILE_SEEDS, applyFitEase, inches } from "@aks/shared";

/** Same size-M TROUSER body sample as the fit-profile admin UI. */
const TROUSER_M_BODY: Record<string, number> = {
  WAIST: inches(30),
  HIP: inches(38),
  THIGH: inches(22),
  RISE: inches(11),
  LENGTH: inches(38),
  BOTTOM_OPENING: inches(14),
};

describe("S3 fit profile ease preview", () => {
  it("Palazzo against size M shows finished with ease applied", () => {
    const palazzo = FIT_PROFILE_SEEDS.find((p) => p.name === "Palazzo");
    expect(palazzo).toBeDefined();

    const finished = applyFitEase(
      TROUSER_M_BODY,
      palazzo!.easeByMeasurement,
    );

    // body + ease
    expect(finished.WAIST).toBe(inches(31));
    expect(finished.HIP).toBe(inches(46));
    // BOTTOM_OPENING is absolute finished opening
    expect(finished.BOTTOM_OPENING).toBe(inches(24));
    // keys without ease pass through
    expect(finished.LENGTH).toBe(inches(38));
  });

  it("ease values remain integer hundredths", () => {
    const palazzo = FIT_PROFILE_SEEDS.find((p) => p.name === "Palazzo")!;
    for (const value of Object.values(palazzo.easeByMeasurement)) {
      expect(Number.isInteger(value)).toBe(true);
    }
    const finished = applyFitEase(
      TROUSER_M_BODY,
      palazzo.easeByMeasurement,
    );
    for (const value of Object.values(finished)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
