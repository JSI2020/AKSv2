import { describe, expect, it } from "vitest";

import { inches } from "@aks/shared";

import { calculateCutSpec } from "@/modules/sizing/engine";

import { formatMetres } from "./format-metres";
import {
  buildCutSpecRows,
  measurementLabelEn,
  measurementLabelUr,
} from "./spec-sheet";

describe("formatMetres", () => {
  it("formats integer hundredths of a metre", () => {
    expect(formatMetres(450)).toBe("4.5 m");
    expect(formatMetres(400)).toBe("4 m");
    expect(formatMetres(405)).toBe("4.05 m");
  });
});

describe("buildCutSpecRows", () => {
  it("matches calculateCutSpec output exactly", () => {
    const body = {
      WAIST: inches(30),
      HIP: inches(38),
      LENGTH: inches(38),
      BOTTOM_OPENING: inches(14),
    };
    const spec = calculateCutSpec({
      body,
      fitProfile: {
        easeByMeasurement: {
          WAIST: inches(1),
          HIP: inches(8),
          BOTTOM_OPENING: inches(24),
        },
      },
      fabric: { stretchPercent: 0, shrinkageAllowance: inches(0.5) },
    });

    const rows = buildCutSpecRows(spec);
    expect(rows).toHaveLength(Object.keys(spec).length);

    for (const row of rows) {
      expect(row.valueHundredths).toBe(spec[row.key]);
      expect(row.valueHundredths % 25).toBe(0);
    }
  });

  it("labels component-prefixed keys bilingually", () => {
    const rows = buildCutSpecRows({ "KAMEEZ:WAIST": inches(31.5) });
    expect(rows[0]?.labelEn).toContain("Kameez");
    expect(rows[0]?.labelEn).toContain("Waist");
    expect(rows[0]?.labelUr).toContain("کمر");
  });
});

describe("measurementLabelEn", () => {
  it("uses catalogue labels", () => {
    expect(measurementLabelEn("WAIST")).toBe("Waist");
    expect(measurementLabelUr("WAIST")).toBe("کمر");
  });
});
