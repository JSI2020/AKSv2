import {
  GARMENT_CATEGORY_SEEDS,
  MEASUREMENT_KEY_DEFS,
  type MeasurementKeyCode,
} from "@aks/shared";

/** Default anchor Y — hundredths of a percent of image height from top. */
export const ANCHOR_Y_BP_BY_POINT: Record<string, number> = {
  bust_line: 2200,
  waist_line: 3800,
  hip_line: 4800,
  shoulder_line: 1400,
  shoulder_point: 1500,
  cuff: 5500,
  armhole: 1800,
  neck_front: 1200,
  neck_back: 1200,
  thigh: 5200,
  hem: 9000,
  centre: 5000,
};

const MEASUREMENT_DEF_BY_KEY = new Map(
  MEASUREMENT_KEY_DEFS.map((d) => [d.key, d]),
);

export type OverlayLineDirection = "down" | "horizontal";

const VERTICAL_MEASUREMENTS = new Set<string>([
  "LENGTH",
  "RISE",
  "SLEEVE_LENGTH",
  "NECK_DEPTH_FRONT",
  "NECK_DEPTH_BACK",
]);

export function overlayDirection(measurementKey: string): OverlayLineDirection {
  return VERTICAL_MEASUREMENTS.has(measurementKey) ? "down" : "horizontal";
}

export function defaultAnchorYBp(measurementKey: string): number {
  const def = MEASUREMENT_DEF_BY_KEY.get(measurementKey as MeasurementKeyCode);
  if (!def) return 5000;
  return ANCHOR_Y_BP_BY_POINT[def.anchorPoint] ?? 5000;
}

export function anchorYpx(
  anchorYBp: number,
  imageHeightPx: number,
): number {
  return Math.round((anchorYBp / 10_000) * imageHeightPx);
}

export type OverlayGuideLine = {
  measurementKey: string;
  label: string;
  anchorYPx: number;
  yPx: number;
  direction: OverlayLineDirection;
  valueHundredths: number;
  displayLabel: string;
};

export function computeOverlayLines(input: {
  imageHeightPx: number;
  modelPixelHeight: number;
  archetypeHeightInches: number;
  anchorYBpByKey: Record<string, number>;
  valuesByKey: Record<string, number>;
  formatValue: (hundredths: number) => string;
}): OverlayGuideLine[] {
  const ppi = input.modelPixelHeight / (input.archetypeHeightInches / 100);
  const lines: OverlayGuideLine[] = [];

  for (const [measurementKey, valueHundredths] of Object.entries(
    input.valuesByKey,
  )) {
    const def = MEASUREMENT_DEF_BY_KEY.get(measurementKey as MeasurementKeyCode);
    if (!def) continue;

    const anchorYBp =
      input.anchorYBpByKey[measurementKey] ?? defaultAnchorYBp(measurementKey);
    const anchorY = anchorYpx(anchorYBp, input.imageHeightPx);
    const direction = overlayDirection(measurementKey);
    const offsetPx =
      direction === "down" ? Math.round((valueHundredths / 100) * ppi) : 0;

    lines.push({
      measurementKey,
      label: def.label,
      anchorYPx: anchorY,
      yPx: anchorY + offsetPx,
      direction,
      valueHundredths,
      displayLabel: input.formatValue(valueHundredths),
    });
  }

  return lines.sort((a, b) => a.yPx - b.yPx);
}

export function categoryKeysForComponents(components: readonly string[]): string[] {
  if (components.length > 0) return [...components];
  return GARMENT_CATEGORY_SEEDS.map((c) => c.key);
}
