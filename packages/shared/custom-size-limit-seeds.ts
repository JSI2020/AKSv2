import type { CrossFieldRule } from "./cross-field-rules";

export type CustomSizeLimitSeed = {
  categoryKey: string;
  measurementKey: string;
  minValue: number;
  maxValue: number;
  step?: number;
  crossFieldRules?: CrossFieldRule[];
};

/** Step 26 seeded limits — hundredths of an inch. */
export const CUSTOM_SIZE_LIMIT_SEEDS: readonly CustomSizeLimitSeed[] = [
  {
    categoryKey: "KAMEEZ",
    measurementKey: "BUST",
    minValue: 3000,
    maxValue: 5200,
  },
  {
    categoryKey: "KAMEEZ",
    measurementKey: "WAIST",
    minValue: 2200,
    maxValue: 4800,
  },
  {
    categoryKey: "KAMEEZ",
    measurementKey: "HIP",
    minValue: 3200,
    maxValue: 5600,
    crossFieldRules: [
      {
        op: "gte",
        otherMeasurementKey: "WAIST",
      },
    ],
  },
  {
    categoryKey: "KAMEEZ",
    measurementKey: "SHOULDER",
    minValue: 1200,
    maxValue: 2000,
  },
  {
    categoryKey: "KAMEEZ",
    measurementKey: "SLEEVE_LENGTH",
    minValue: 0,
    maxValue: 2600,
    crossFieldRules: [
      {
        op: "lte",
        otherMeasurementKey: "LENGTH",
      },
    ],
  },
  {
    categoryKey: "KAMEEZ",
    measurementKey: "LENGTH",
    minValue: 2600,
    maxValue: 5200,
  },
  {
    categoryKey: "TROUSER",
    measurementKey: "WAIST",
    minValue: 2200,
    maxValue: 4800,
  },
  {
    categoryKey: "TROUSER",
    measurementKey: "HIP",
    minValue: 3200,
    maxValue: 5600,
    crossFieldRules: [
      {
        op: "gte",
        otherMeasurementKey: "WAIST",
      },
    ],
  },
  {
    categoryKey: "TROUSER",
    measurementKey: "LENGTH",
    minValue: 3200,
    maxValue: 4600,
  },
] as const;
