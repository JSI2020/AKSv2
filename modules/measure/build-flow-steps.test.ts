import { describe, expect, it } from "vitest";

import { buildMeasureFlowSteps, flowValueKey } from "./build-flow-steps";

describe("buildMeasureFlowSteps", () => {
  const categories = [
    {
      id: "cat-kameez",
      key: "KAMEEZ",
      measurementKeys: [
        "BUST",
        "WAIST",
        "HIP",
        "SHOULDER",
        "SLEEVE_LENGTH",
        "LENGTH",
      ],
    },
    {
      id: "cat-trouser",
      key: "TROUSER",
      measurementKeys: ["WAIST", "HIP", "THIGH", "LENGTH"],
    },
  ];

  const measurementKeys = [
    {
      key: "BUST",
      label: "Bust",
      bodyOrGarment: "BODY" as const,
      helpText: "Bust help",
      demoVideoAssetId: null,
    },
    {
      key: "WAIST",
      label: "Waist",
      bodyOrGarment: "BODY" as const,
      helpText: "Waist help",
      demoVideoAssetId: null,
    },
    {
      key: "HIP",
      label: "Hip",
      bodyOrGarment: "BODY" as const,
      helpText: "Hip help",
      demoVideoAssetId: null,
    },
    {
      key: "SHOULDER",
      label: "Shoulder",
      bodyOrGarment: "BODY" as const,
      helpText: "Shoulder help",
      demoVideoAssetId: null,
    },
    {
      key: "SLEEVE_LENGTH",
      label: "Sleeve length",
      bodyOrGarment: "GARMENT" as const,
      helpText: "Sleeve help",
      demoVideoAssetId: null,
    },
    {
      key: "LENGTH",
      label: "Length",
      bodyOrGarment: "GARMENT" as const,
      helpText: "Length help",
      demoVideoAssetId: null,
    },
    {
      key: "THIGH",
      label: "Thigh",
      bodyOrGarment: "BODY" as const,
      helpText: "Thigh help",
      demoVideoAssetId: null,
    },
  ];

  it("dedupes shared body measurements across components", () => {
    const steps = buildMeasureFlowSteps({
      components: ["KAMEEZ", "TROUSER"],
      primaryCategoryKey: "KAMEEZ",
      categories,
      measurementKeys,
    });

    const waistSteps = steps.filter((s) => s.measurementKey === "WAIST");
    expect(waistSteps).toHaveLength(1);
    expect(waistSteps[0]?.componentKey).toBe("KAMEEZ");

    const hipSteps = steps.filter((s) => s.measurementKey === "HIP");
    expect(hipSteps).toHaveLength(1);
  });

  it("keeps separate length steps per component", () => {
    const steps = buildMeasureFlowSteps({
      components: ["KAMEEZ", "TROUSER"],
      primaryCategoryKey: "KAMEEZ",
      categories,
      measurementKeys,
    });

    const lengthSteps = steps.filter((s) => s.measurementKey === "LENGTH");
    expect(lengthSteps).toHaveLength(2);
    expect(lengthSteps.map((s) => s.componentKey).sort()).toEqual([
      "KAMEEZ",
      "TROUSER",
    ]);
  });

  it("uses flow value keys", () => {
    expect(flowValueKey("KAMEEZ", "BUST")).toBe("KAMEEZ:BUST");
  });
});
