import type { CrossFieldRule } from "@aks/shared";

import { roundToQuarterInch } from "./engine";

export type CustomSizeLimitInput = {
  minValue: number;
  maxValue: number;
  step: number;
  crossFieldRules: CrossFieldRule[];
};

export type MeasurementValidationResult = {
  ok: boolean;
  snappedValue: number;
  hardErrors: string[];
  warnings: string[];
};

const MEASUREMENT_LABELS: Record<string, string> = {
  BUST: "bust",
  WAIST: "waist",
  HIP: "hip",
  SHOULDER: "shoulder",
  SLEEVE_LENGTH: "sleeve",
  LENGTH: "length",
  THIGH: "thigh",
  RISE: "rise",
  BOTTOM_OPENING: "bottom opening",
  SLEEVE_OPENING: "sleeve opening",
  ARMHOLE: "armhole",
  NECK_DEPTH_FRONT: "neck depth (front)",
  NECK_DEPTH_BACK: "neck depth (back)",
  SWEEP: "sweep",
  WIDTH: "width",
};

function formatInches(hundredths: number): string {
  const whole = Math.trunc(hundredths / 100);
  const frac = hundredths % 100;
  if (frac === 0) return `${whole}″`;
  if (frac % 10 === 0) return `${whole}.${frac / 10}″`;
  return `${whole}.${frac.toString().padStart(2, "0")}″`;
}

function labelFor(key: string): string {
  return MEASUREMENT_LABELS[key] ?? key.toLowerCase().replace(/_/g, " ");
}

function defaultPlausibilityMessage(params: {
  measurementKey: string;
  value: number;
  otherKey: string;
  otherValue: number;
  op: "gte" | "lte";
}): string {
  const a = formatInches(params.value);
  const b = formatInches(params.otherValue);
  const left = labelFor(params.measurementKey);
  const right = labelFor(params.otherKey);

  if (params.op === "gte") {
    return `A ${a} ${left} with a ${b} ${right} is unusual — worth checking the tape once more.`;
  }
  return `A ${a} ${left} on a ${b} ${right} is unusual — worth checking the tape once more.`;
}

function resolveOtherValue(
  componentKey: string,
  otherKey: string,
  values: Readonly<Record<string, number>>,
): number | undefined {
  const scoped = values[`${componentKey}:${otherKey}`];
  if (scoped !== undefined) return scoped;

  for (const [key, value] of Object.entries(values)) {
    if (key.endsWith(`:${otherKey}`)) return value;
  }
  return values[otherKey];
}

export function snapToStep(value: number, step: number): number {
  if (step <= 0) return roundToQuarterInch(value);
  return Math.round(value / step) * step;
}

export function validateMeasurementValue(input: {
  rawValue: number;
  limit: CustomSizeLimitInput | null;
  componentKey: string;
  measurementKey: string;
  values: Readonly<Record<string, number>>;
}): MeasurementValidationResult {
  const step = input.limit?.step ?? 25;
  const snappedValue = snapToStep(input.rawValue, step);
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isInteger(input.rawValue)) {
    hardErrors.push("Enter a valid measurement.");
    return { ok: false, snappedValue, hardErrors, warnings };
  }

  if (input.limit) {
    if (snappedValue < input.limit.minValue) {
      hardErrors.push(
        `That is below ${formatInches(input.limit.minValue)} — the smallest we can cut.`,
      );
    }
    if (snappedValue > input.limit.maxValue) {
      hardErrors.push(
        `That is above ${formatInches(input.limit.maxValue)} — the largest we can cut.`,
      );
    }
  }

  const rules = input.limit?.crossFieldRules ?? [];
  for (const rule of rules) {
    const otherValue = resolveOtherValue(
      input.componentKey,
      rule.otherMeasurementKey,
      input.values,
    );
    if (otherValue === undefined) continue;

    const violated =
      rule.op === "gte"
        ? snappedValue < otherValue
        : snappedValue > otherValue;

    if (!violated) continue;

    const message =
      rule.message ??
      defaultPlausibilityMessage({
        measurementKey: input.measurementKey,
        value: snappedValue,
        otherKey: rule.otherMeasurementKey,
        otherValue,
        op: rule.op,
      });

    if (rule.blocking) {
      hardErrors.push(message);
    } else {
      warnings.push(message);
    }
  }

  return {
    ok: hardErrors.length === 0,
    snappedValue,
    hardErrors,
    warnings,
  };
}
