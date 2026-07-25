/** Cross-field plausibility rule for custom size limits. */
export type CrossFieldRule = {
  op: "gte" | "lte";
  otherMeasurementKey: string;
  /** When true, hard block; otherwise prompt only. */
  blocking?: boolean;
  message?: string;
};
