import { describe, expect, it } from "vitest";

import { inches } from "@aks/shared";

import { calculateCutSpec, roundToQuarterInch } from "./calculate-cut-spec";

describe("roundToQuarterInch", () => {
  it("rounds to nearest 0.25″", () => {
    expect(roundToQuarterInch(3600)).toBe(3600);
    expect(roundToQuarterInch(3610)).toBe(3600);
    expect(roundToQuarterInch(3613)).toBe(3625);
    expect(roundToQuarterInch(3637)).toBe(3625);
    expect(roundToQuarterInch(3638)).toBe(3650);
  });
});

describe("calculateCutSpec", () => {
  const fit = {
    easeByMeasurement: {
      WAIST: inches(1),
      HIP: inches(8),
      BOTTOM_OPENING: inches(24),
    },
  };

  const fabric = {
    stretchPercent: 0,
    shrinkageAllowance: inches(0.5),
  };

  it("standard size input produces a correct spec", () => {
    const body = {
      WAIST: inches(30),
      HIP: inches(38),
      LENGTH: inches(38),
      BOTTOM_OPENING: inches(14),
    };
    const spec = calculateCutSpec({ body, fitProfile: fit, fabric });
    // waist: 30 + 1 + 0.5 = 31.5
    expect(spec.WAIST).toBe(inches(31.5));
    // hip: 38 + 8 + 0.5 = 46.5
    expect(spec.HIP).toBe(inches(46.5));
    // length: no ease → 38 + 0.5 = 38.5
    expect(spec.LENGTH).toBe(inches(38.5));
    // bottom absolute 24 + 0.5 shrink
    expect(spec.BOTTOM_OPENING).toBe(inches(24.5));
  });

  it("custom measurement input produces a correct spec through the identical function", () => {
    const body = {
      WAIST: inches(29.25),
      HIP: inches(40),
      LENGTH: inches(37),
    };
    const spec = calculateCutSpec({ body, fitProfile: fit, fabric });
    expect(spec.WAIST).toBe(inches(30.75)); // 29.25+1+0.5
    expect(spec.HIP).toBe(inches(48.5));
    expect(spec.LENGTH).toBe(inches(37.5));
  });

  it("stretch reduces ease", () => {
    const body = { WAIST: inches(30), HIP: inches(38) };
    const withStretch = calculateCutSpec({
      body,
      fitProfile: fit,
      fabric: { stretchPercent: 50, shrinkageAllowance: 0 },
    });
    // waist ease 1″ * 0.5 = 0.5 → 30.5
    expect(withStretch.WAIST).toBe(inches(30.5));
    // hip ease 8″ * 0.5 = 4 → 42
    expect(withStretch.HIP).toBe(inches(42));
  });

  it("shrinkage increases the cut", () => {
    const body = { WAIST: inches(30) };
    const none = calculateCutSpec({
      body,
      fitProfile: { easeByMeasurement: { WAIST: inches(2) } },
      fabric: { stretchPercent: 0, shrinkageAllowance: 0 },
    });
    const shrunk = calculateCutSpec({
      body,
      fitProfile: { easeByMeasurement: { WAIST: inches(2) } },
      fabric: { stretchPercent: 0, shrinkageAllowance: inches(0.75) },
    });
    expect(shrunk.WAIST! - none.WAIST!).toBe(inches(0.75));
  });

  it("designLengths replace computed then add shrinkage", () => {
    const spec = calculateCutSpec({
      body: { LENGTH: inches(30), WAIST: inches(32) },
      fitProfile: { easeByMeasurement: { WAIST: inches(4) } },
      fabric: { stretchPercent: 0, shrinkageAllowance: inches(0.5) },
      designLengths: { LENGTH: inches(27) },
    });
    expect(spec.LENGTH).toBe(inches(27.5));
    expect(spec.WAIST).toBe(inches(36.5));
  });

  it("every output rounds to 0.25″", () => {
    const spec = calculateCutSpec({
      body: { WAIST: 3017, HIP: 3823 },
      fitProfile: { easeByMeasurement: { WAIST: 100, HIP: 200 } },
      fabric: { stretchPercent: 10, shrinkageAllowance: 37 },
    });
    for (const v of Object.values(spec)) {
      expect(v % 25).toBe(0);
    }
  });
});
