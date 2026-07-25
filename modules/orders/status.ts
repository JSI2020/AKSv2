import type { OrderStatus } from "./constants";

/** Production pipeline stage — independent from payment status. */
export type ProductionStatus =
  | "DRAFT"
  | "RECEIVED"
  | "CONFIRMED"
  | "MEASUREMENTS_VERIFIED"
  | "CUTTING"
  | "STITCHING"
  | "EMBROIDERY"
  | "FINISHING"
  | "QUALITY_CHECK"
  | "PACKED"
  | "DISPATCHED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "DELIVERY_REFUSED"
  | "WRITE_OFF";

/** Payment collection state — independent from production status. */
export type PaymentStatus =
  | "DRAFT"
  | "AWAITING_DEPOSIT"
  | "DEPOSIT_PAID"
  | "BALANCE_DUE"
  | "PAID"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "CANCELLED";

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  DRAFT: "Draft",
  RECEIVED: "Received",
  CONFIRMED: "Confirmed",
  MEASUREMENTS_VERIFIED: "Measurements verified",
  CUTTING: "Cutting",
  STITCHING: "Stitching",
  EMBROIDERY: "Embroidery",
  FINISHING: "Finishing",
  QUALITY_CHECK: "Quality check",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  DELIVERY_REFUSED: "Delivery refused",
  WRITE_OFF: "Write off",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  DRAFT: "Draft",
  AWAITING_DEPOSIT: "Awaiting deposit",
  DEPOSIT_PAID: "Deposit paid",
  BALANCE_DUE: "Balance due",
  PAID: "Paid in full",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

const ORDER_TO_PRODUCTION: Record<OrderStatus, ProductionStatus> = {
  DRAFT: "DRAFT",
  AWAITING_DEPOSIT: "RECEIVED",
  DEPOSIT_PAID: "CONFIRMED",
  MEASUREMENTS_CONFIRMED: "MEASUREMENTS_VERIFIED",
  CUTTING: "CUTTING",
  STITCHING: "STITCHING",
  EMBROIDERY: "EMBROIDERY",
  FINISHING: "FINISHING",
  IN_PRODUCTION: "CUTTING",
  QUALITY_CHECK: "QUALITY_CHECK",
  READY_TO_SHIP: "PACKED",
  DISPATCHED: "DISPATCHED",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REFUND_PENDING: "CANCELLED",
  REFUNDED: "REFUNDED",
  DELIVERY_REFUSED: "DELIVERY_REFUSED",
  WRITE_OFF: "WRITE_OFF",
};

export function deriveProductionStatus(status: OrderStatus): ProductionStatus {
  return ORDER_TO_PRODUCTION[status];
}

export function derivePaymentStatus(input: {
  status: OrderStatus;
  balanceAmountMinor: number;
  paidMinor: number;
  totalMinor: number;
}): PaymentStatus {
  const { status, balanceAmountMinor, paidMinor, totalMinor } = input;

  if (status === "DRAFT") return "DRAFT";
  if (status === "AWAITING_DEPOSIT") return "AWAITING_DEPOSIT";
  if (status === "REFUND_PENDING") return "REFUND_PENDING";
  if (status === "REFUNDED") return "REFUNDED";
  if (status === "CANCELLED") return "CANCELLED";

  if (paidMinor >= totalMinor && totalMinor > 0) return "PAID";
  if (paidMinor > 0 && balanceAmountMinor > 0) return "BALANCE_DUE";
  if (status === "DEPOSIT_PAID" || paidMinor > 0) return "DEPOSIT_PAID";

  return "AWAITING_DEPOSIT";
}

/** Promised ship date within three days or passed, while still in-flight. */
export function isOrderAtRisk(input: {
  promisedShipDate: Date | null;
  status: OrderStatus;
  now?: Date;
}): boolean {
  const { promisedShipDate, status } = input;
  if (!promisedShipDate) return false;

  const terminal: OrderStatus[] = [
    "COMPLETED",
    "CANCELLED",
    "REFUNDED",
    "WRITE_OFF",
    "DELIVERY_REFUSED",
  ];
  if (terminal.includes(status)) return false;

  const now = input.now ?? new Date();
  const thresholdMs = 3 * 24 * 60 * 60 * 1000;
  return promisedShipDate.getTime() <= now.getTime() + thresholdMs;
}

export const PRODUCTION_STATUS_FILTER_VALUES = [
  "DRAFT",
  "RECEIVED",
  "CONFIRMED",
  "MEASUREMENTS_VERIFIED",
  "CUTTING",
  "STITCHING",
  "EMBROIDERY",
  "FINISHING",
  "QUALITY_CHECK",
  "PACKED",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "DELIVERY_REFUSED",
  "WRITE_OFF",
] as const satisfies readonly ProductionStatus[];

export const PAYMENT_STATUS_FILTER_VALUES = [
  "DRAFT",
  "AWAITING_DEPOSIT",
  "DEPOSIT_PAID",
  "BALANCE_DUE",
  "PAID",
  "REFUND_PENDING",
  "REFUNDED",
  "CANCELLED",
] as const satisfies readonly PaymentStatus[];

export const PRODUCTION_TO_ORDER_STATUSES: Record<
  ProductionStatus,
  readonly OrderStatus[]
> = {
  DRAFT: ["DRAFT"],
  RECEIVED: ["AWAITING_DEPOSIT"],
  CONFIRMED: ["DEPOSIT_PAID"],
  MEASUREMENTS_VERIFIED: ["MEASUREMENTS_CONFIRMED"],
  CUTTING: ["CUTTING", "IN_PRODUCTION"],
  STITCHING: ["STITCHING"],
  EMBROIDERY: ["EMBROIDERY"],
  FINISHING: ["FINISHING"],
  QUALITY_CHECK: ["QUALITY_CHECK"],
  PACKED: ["READY_TO_SHIP"],
  DISPATCHED: ["DISPATCHED"],
  DELIVERED: ["DELIVERED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED", "REFUND_PENDING"],
  REFUNDED: ["REFUNDED"],
  DELIVERY_REFUSED: ["DELIVERY_REFUSED"],
  WRITE_OFF: ["WRITE_OFF"],
};

export function getNextProductionStage(
  status: OrderStatus,
  skipEmbroidery: boolean,
): OrderStatus | null {
  switch (status) {
    case "MEASUREMENTS_CONFIRMED":
      return "CUTTING";
    case "CUTTING":
      return "STITCHING";
    case "STITCHING":
      return skipEmbroidery ? "FINISHING" : "EMBROIDERY";
    case "EMBROIDERY":
      return "FINISHING";
    case "FINISHING":
      return "QUALITY_CHECK";
    case "QUALITY_CHECK":
      return "READY_TO_SHIP";
    case "READY_TO_SHIP":
      return "DISPATCHED";
    case "DISPATCHED":
      return "DELIVERED";
    case "DELIVERED":
      return "COMPLETED";
    default:
      return null;
  }
}

/** @deprecated use getNextProductionStage */
export const ADVANCE_STAGE_TARGETS: Partial<
  Record<OrderStatus, OrderStatus>
> = {
  MEASUREMENTS_CONFIRMED: "CUTTING",
  CUTTING: "STITCHING",
  STITCHING: "EMBROIDERY",
  EMBROIDERY: "FINISHING",
  FINISHING: "QUALITY_CHECK",
  QUALITY_CHECK: "READY_TO_SHIP",
  READY_TO_SHIP: "DISPATCHED",
  DISPATCHED: "DELIVERED",
  DELIVERED: "COMPLETED",
};

export function isBeforeProductionLock(status: OrderStatus): boolean {
  return (
    status === "DRAFT" ||
    status === "AWAITING_DEPOSIT" ||
    status === "DEPOSIT_PAID"
  );
}

export function productionStageLabel(status: OrderStatus): string {
  return PRODUCTION_STATUS_LABELS[deriveProductionStatus(status)];
}

export function paymentStatusLabel(input: {
  status: OrderStatus;
  balanceAmountMinor: number;
  paidMinor: number;
  totalMinor: number;
}): string {
  return PAYMENT_STATUS_LABELS[derivePaymentStatus(input)];
}

export type TimelineStepState = "complete" | "current" | "upcoming";

export type ProductionTimelineStep = {
  key: ProductionStatus;
  label: string;
  state: TimelineStepState;
  skipped?: boolean;
};

const TIMELINE_DEFS: Array<{ key: ProductionStatus; label: string }> = [
  { key: "RECEIVED", label: "Received" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "MEASUREMENTS_VERIFIED", label: "Measurements checked" },
  { key: "CUTTING", label: "Being cut" },
  { key: "STITCHING", label: "With the karigar" },
  { key: "EMBROIDERY", label: "Embroidery" },
  { key: "FINISHING", label: "Finishing" },
  { key: "QUALITY_CHECK", label: "Final check" },
  { key: "PACKED", label: "Packed" },
  { key: "DISPATCHED", label: "On its way" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETED", label: "Complete" },
];

const TIMELINE_ORDER = TIMELINE_DEFS.map((d) => d.key);

export function timelineStepState(
  step: ProductionStatus,
  current: ProductionStatus,
): TimelineStepState {
  const currentIndex = TIMELINE_ORDER.indexOf(current);
  const stepIndex = TIMELINE_ORDER.indexOf(step);
  if (currentIndex < 0 || stepIndex < 0) return "upcoming";
  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

/** Customer-facing workshop timeline — embroidery omitted when skipped. */
export function buildProductionTimeline(input: {
  currentStatus: OrderStatus;
  skipEmbroidery: boolean;
}): ProductionTimelineStep[] {
  const current = deriveProductionStatus(input.currentStatus);

  return TIMELINE_DEFS.filter(
    (def) => !(def.key === "EMBROIDERY" && input.skipEmbroidery),
  ).map((def) => ({
    key: def.key,
    label: def.label,
    state: timelineStepState(def.key, current),
    skipped: def.key === "EMBROIDERY" && input.skipEmbroidery,
  }));
}
