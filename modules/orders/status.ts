import type { OrderStatus } from "./constants";

/** Production pipeline stage — independent from payment status. */
export type ProductionStatus =
  | "DRAFT"
  | "RECEIVED"
  | "CONFIRMED"
  | "MEASUREMENTS_VERIFIED"
  | "IN_PRODUCTION"
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
  IN_PRODUCTION: "In production",
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
  IN_PRODUCTION: "IN_PRODUCTION",
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
  "IN_PRODUCTION",
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
  IN_PRODUCTION: ["IN_PRODUCTION"],
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

/** Next production transition after measurements are confirmed. */
export const ADVANCE_STAGE_TARGETS: Partial<
  Record<OrderStatus, OrderStatus>
> = {
  MEASUREMENTS_CONFIRMED: "IN_PRODUCTION",
  IN_PRODUCTION: "QUALITY_CHECK",
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
