import { describe, expect, it } from "vitest";

import { inches } from "@aks/shared";

import {
  snapToStep,
  validateMeasurementValue,
} from "./validate-measurement";

describe("validateMeasurementValue", () => {
  const kameezHipLimit = {
    minValue: inches(32),
    maxValue: inches(56),
    step: 25,
    crossFieldRules: [{ op: "gte" as const, otherMeasurementKey: "WAIST" }],
  };

  it("snaps to 0.25″ steps", () => {
    const result = validateMeasurementValue({
      rawValue: 3650,
      limit: { minValue: 0, maxValue: 99999, step: 25, crossFieldRules: [] },
      componentKey: "KAMEEZ",
      measurementKey: "BUST",
      values: {},
    });
    expect(result.snappedValue).toBe(3650);
    expect(result.ok).toBe(true);
  });

  it("blocks below min and above max", () => {
    const limit = {
      minValue: inches(30),
      maxValue: inches(52),
      step: 25,
      crossFieldRules: [],
    };
    const low = validateMeasurementValue({
      rawValue: inches(28),
      limit,
      componentKey: "KAMEEZ",
      measurementKey: "BUST",
      values: {},
    });
    expect(low.ok).toBe(false);
    expect(low.hardErrors.length).toBeGreaterThan(0);

    const high = validateMeasurementValue({
      rawValue: inches(54),
      limit,
      componentKey: "KAMEEZ",
      measurementKey: "BUST",
      values: {},
    });
    expect(high.ok).toBe(false);
  });

  it("warns when hip is less than waist but does not block", () => {
    const result = validateMeasurementValue({
      rawValue: inches(34),
      limit: kameezHipLimit,
      componentKey: "KAMEEZ",
      measurementKey: "HIP",
      values: { "KAMEEZ:WAIST": inches(38) },
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("unusual");
  });

  it("warns when sleeve exceeds length", () => {
    const result = validateMeasurementValue({
      rawValue: inches(24),
      limit: {
        minValue: 0,
        maxValue: inches(26),
        step: 25,
        crossFieldRules: [{ op: "lte", otherMeasurementKey: "LENGTH" }],
      },
      componentKey: "KAMEEZ",
      measurementKey: "SLEEVE_LENGTH",
      values: { "KAMEEZ:LENGTH": inches(22) },
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBe(1);
  });
});

describe("snapToStep", () => {
  it("defaults to quarter inch", () => {
    expect(snapToStep(1248, 25)).toBe(1250);
  });
});
