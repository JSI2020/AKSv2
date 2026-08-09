export const PRODUCTION_JOB_STAGES = [
  "CUTTING",
  "STITCHING",
  "EMBROIDERY",
  "FINISHING",
  "QC",
  "PACKED",
] as const;

export type ProductionJobStage = (typeof PRODUCTION_JOB_STAGES)[number];

export type ProductionJobStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "DONE";

/**
 * Workflow status machine (separate from stage). Blocking / unblocking
 * must go through transition() with entity `production_job_status`.
 */
export const PRODUCTION_JOB_STATUS_ALLOW: Record<
  ProductionJobStatus,
  readonly ProductionJobStatus[]
> = {
  PENDING: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["BLOCKED", "DONE", "PENDING"],
  BLOCKED: ["IN_PROGRESS", "PENDING"],
  DONE: [],
};

export type ReworkFaultAttribution =
  | "OUR_ERROR"
  | "CUSTOMER_MEASUREMENT"
  | "FABRIC_DEFECT"
  | "UNDETERMINED";

/** Linear stage machine — embroidery skip resolved at transition time. */
export const PRODUCTION_STAGE_ALLOW: Record<
  ProductionJobStage,
  readonly ProductionJobStage[]
> = {
  CUTTING: ["STITCHING"],
  STITCHING: ["EMBROIDERY", "FINISHING"],
  EMBROIDERY: ["FINISHING"],
  FINISHING: ["QC"],
  QC: ["PACKED", "STITCHING", "FINISHING", "CUTTING"],
  PACKED: [],
};

export const PRODUCTION_STAGE_LABELS: Record<ProductionJobStage, string> = {
  CUTTING: "Cutting",
  STITCHING: "Stitching",
  EMBROIDERY: "Embroidery",
  FINISHING: "Finishing",
  QC: "QC",
  PACKED: "Packed",
};

export const STAFF_ROLE_FOR_STAGE: Record<
  ProductionJobStage,
  "CUTTER" | "STITCHER" | "EMBROIDERER" | "FINISHER" | "QC" | null
> = {
  CUTTING: "CUTTER",
  STITCHING: "STITCHER",
  EMBROIDERY: "EMBROIDERER",
  FINISHING: "FINISHER",
  QC: "QC",
  PACKED: null,
};

/** Rework return targets by fault attribution. */
export const REWORK_RETURN_STAGE: Record<
  ReworkFaultAttribution,
  ProductionJobStage
> = {
  OUR_ERROR: "STITCHING",
  CUSTOMER_MEASUREMENT: "STITCHING",
  FABRIC_DEFECT: "CUTTING",
  UNDETERMINED: "FINISHING",
};

export function reworkChargeCustomer(
  fault: ReworkFaultAttribution,
): boolean {
  return fault === "CUSTOMER_MEASUREMENT";
}

export function reworkCostMinor(fault: ReworkFaultAttribution): number {
  if (fault === "OUR_ERROR" || fault === "FABRIC_DEFECT") return 0;
  if (fault === "CUSTOMER_MEASUREMENT") return 0;
  return 0;
}

/** Days until promised ship — negative means overdue. */
export function daysToPromisedShip(
  promisedShipDate: Date | null,
  now = new Date(),
): number | null {
  if (!promisedShipDate) return null;
  const ms = promisedShipDate.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function isAtRisk(
  promisedShipDate: Date | null,
  stage: ProductionJobStage,
  now = new Date(),
): boolean {
  if (stage === "PACKED") return false;
  const days = daysToPromisedShip(promisedShipDate, now);
  if (days === null) return false;
  return days <= 2;
}

export function customerFirstName(recipientName: string | null | undefined): string {
  if (!recipientName?.trim()) return "Guest";
  return recipientName.trim().split(/\s+/)[0] ?? "Guest";
}

export function sizeModeLabel(
  sizeMode: "STANDARD" | "MADE_TO_MEASURE",
): "M" | "Custom" {
  return sizeMode === "MADE_TO_MEASURE" ? "Custom" : "M";
}
