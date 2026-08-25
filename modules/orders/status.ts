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
  RECEIVED: "Order received",
  CONFIRMED: "Order confirmed",
  MEASUREMENTS_VERIFIED: "Order confirmed",
  CUTTING: "Cutting",
  STITCHING: "Stitching",
  EMBROIDERY: "Stitching",
  FINISHING: "Finished",
  QUALITY_CHECK: "Quality check",
  PACKED: "Packing",
  DISPATCHED: "Sent",
  DELIVERED: "Delivered",
  COMPLETED: "Delivered",
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

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "WRITE_OFF",
  "DELIVERY_REFUSED",
];

/** Open pipeline — excludes draft and terminal outcomes. */
export const OPEN_PRODUCTION_STATUSES: readonly ProductionStatus[] = [
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
];

/** Actively being made (excludes newly received). */
export const IN_PROGRESS_PRODUCTION_STATUSES: readonly ProductionStatus[] = [
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
];

export const FUNNEL_PRODUCTION_STAGES: readonly ProductionStatus[] = [
  "RECEIVED",
  "CONFIRMED",
  "CUTTING",
  "STITCHING",
  "FINISHING",
  "DISPATCHED",
];

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}

/** Days until promised ship — negative means overdue. */
export function daysUntilPromised(
  promisedShipDate: Date | null,
  now = new Date(),
): number | null {
  if (!promisedShipDate) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(promisedShipDate);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export type DueTone = "overdue" | "soon" | "ok" | "done";

export function dueTone(input: {
  promisedShipDate: Date | null;
  status: OrderStatus;
  now?: Date;
}): DueTone {
  if (isTerminalOrderStatus(input.status)) return "done";
  const days = daysUntilPromised(input.promisedShipDate, input.now);
  if (days === null) return "ok";
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "ok";
}

export function formatRelativeDue(input: {
  promisedShipDate: Date | null;
  status: OrderStatus;
  now?: Date;
}): string {
  if (isTerminalOrderStatus(input.status)) return "completed";
  const days = daysUntilPromised(input.promisedShipDate, input.now);
  if (days === null) return "—";
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "due today";
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** Promised ship date within three days or passed, while still in-flight. */
export function isOrderAtRisk(input: {
  promisedShipDate: Date | null;
  status: OrderStatus;
  now?: Date;
}): boolean {
  const tone = dueTone(input);
  return tone === "overdue" || tone === "soon";
}

export function isOrderOverdue(input: {
  promisedShipDate: Date | null;
  status: OrderStatus;
  now?: Date;
}): boolean {
  return dueTone(input) === "overdue";
}

export function isOrderDueSoon(input: {
  promisedShipDate: Date | null;
  status: OrderStatus;
  now?: Date;
}): boolean {
  return dueTone(input) === "soon";
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

/** Customer-facing / admin pipeline labels (HTML + staff wording). */
export const ADMIN_PIPELINE_STEPS = [
  {
    key: "RECEIVED",
    label: "Order received",
    statuses: ["AWAITING_DEPOSIT"] as const,
  },
  {
    key: "CONFIRMED",
    label: "Order confirmed",
    statuses: ["DEPOSIT_PAID", "MEASUREMENTS_CONFIRMED"] as const,
  },
  {
    key: "CUTTING",
    label: "Cutting",
    statuses: ["CUTTING"] as const,
  },
  {
    key: "STITCHING",
    label: "Stitching",
    statuses: ["STITCHING", "EMBROIDERY"] as const,
  },
  {
    key: "FINISHING",
    label: "Finished",
    statuses: ["FINISHING"] as const,
  },
  {
    key: "QUALITY_CHECK",
    label: "Quality check",
    statuses: ["QUALITY_CHECK"] as const,
  },
  {
    key: "PACKING",
    label: "Packing",
    statuses: ["READY_TO_SHIP"] as const,
  },
  {
    key: "SENT",
    label: "Sent",
    statuses: ["DISPATCHED"] as const,
  },
  {
    key: "DELIVERED",
    label: "Delivered",
    statuses: ["DELIVERED", "COMPLETED"] as const,
  },
] as const;

export type AdminPipelineStepState = "done" | "current" | "upcoming";

export type AdminPipelineStep = {
  key: string;
  label: string;
  state: AdminPipelineStepState;
};

/** Full production rail for every order detail. */
export function buildAdminProductionPipeline(
  status: OrderStatus,
): AdminPipelineStep[] {
  if (
    status === "CANCELLED" ||
    status === "REFUNDED" ||
    status === "REFUND_PENDING" ||
    status === "WRITE_OFF" ||
    status === "DELIVERY_REFUSED" ||
    status === "DRAFT"
  ) {
    return ADMIN_PIPELINE_STEPS.map((step) => ({
      key: step.key,
      label: step.label,
      state: "upcoming" as const,
    }));
  }

  const mapped =
    status === "IN_PRODUCTION" ? ("CUTTING" as OrderStatus) : status;

  let currentIdx = ADMIN_PIPELINE_STEPS.findIndex((step) =>
    (step.statuses as readonly string[]).includes(mapped),
  );
  if (currentIdx < 0) currentIdx = 0;

  return ADMIN_PIPELINE_STEPS.map((step, i) => ({
    key: step.key,
    label: step.label,
    state:
      i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming",
  }));
}

export function paymentStatusLabel(input: {
  status: OrderStatus;
  balanceAmountMinor: number;
  paidMinor: number;
  totalMinor: number;
}): string {
  return PAYMENT_STATUS_LABELS[derivePaymentStatus(input)];
}

/** Admin stagepick strip around the current order status. */
export type StagePickKind = "past" | "current" | "next" | "locked";

export type StagePickItem = {
  status: OrderStatus;
  label: string;
  kind: StagePickKind;
};

export function buildStagePick(
  status: OrderStatus,
  skipEmbroidery: boolean,
): StagePickItem[] {
  const path: OrderStatus[] = [
    "AWAITING_DEPOSIT",
    "DEPOSIT_PAID",
    "MEASUREMENTS_CONFIRMED",
    "CUTTING",
    "STITCHING",
  ];
  if (!skipEmbroidery) path.push("EMBROIDERY");
  path.push(
    "FINISHING",
    "QUALITY_CHECK",
    "READY_TO_SHIP",
    "DISPATCHED",
    "DELIVERED",
    "COMPLETED",
  );

  let idx = path.indexOf(status);
  if (status === "IN_PRODUCTION") idx = path.indexOf("CUTTING");
  if (status === "DRAFT") {
    return path.slice(0, 4).map((s, i) => ({
      status: s,
      label: productionStageLabel(s),
      kind: (i === 0 ? "next" : "locked") as StagePickKind,
    }));
  }
  if (idx < 0) {
    return [
      {
        status,
        label: productionStageLabel(status),
        kind: "current",
      },
    ];
  }

  const start = Math.max(0, idx - 1);
  const end = Math.min(path.length, idx + 3);
  const slice = path.slice(start, end);

  return slice.map((s) => {
    const i = path.indexOf(s);
    let kind: StagePickKind = "locked";
    if (i < idx) kind = "past";
    else if (i === idx) kind = "current";
    else if (i === idx + 1) kind = "next";
    else kind = "locked";
    const prefix =
      kind === "past" ? "← " : kind === "next" ? "" : kind === "locked" ? "" : "";
    const suffix =
      kind === "past"
        ? " ✓"
        : kind === "current"
          ? " (current)"
          : kind === "next"
            ? " →"
            : " 🔒";
    return {
      status: s,
      label: `${prefix}${productionStageLabel(s)}${suffix}`,
      kind,
    };
  });
}

export function gateNoteForStage(
  status: OrderStatus,
  skipEmbroidery: boolean,
): string | null {
  const next = getNextProductionStage(status, skipEmbroidery);
  if (!next) return null;
  if (status === "STITCHING" && !skipEmbroidery) {
    return "◆ Finishing unlocks after embroidery completes.";
  }
  if (status === "STITCHING" && skipEmbroidery) {
    return "◆ Embroidery skipped — Finishing is next.";
  }
  if (status === "DEPOSIT_PAID") {
    return "◆ Cutting unlocks after measurements are verified.";
  }
  return `◆ ${productionStageLabel(next)} unlocks after this stage completes.`;
}

export type TimelineStepState = "complete" | "current" | "upcoming";

export type ProductionTimelineStep = {
  key: ProductionStatus;
  label: string;
  message: string;
  state: TimelineStepState;
  skipped?: boolean;
  /** Display timestamp for customer tracking, when known */
  atLabel?: string | null;
};

const TIMELINE_DEFS: Array<{
  key: ProductionStatus;
  label: string;
  message: string;
}> = [
  {
    key: "RECEIVED",
    label: "Order received",
    message: "We've got your order — it begins now.",
  },
  {
    key: "CONFIRMED",
    label: "Confirmed",
    message: "Confirmed. We're preparing to cut.",
  },
  {
    key: "MEASUREMENTS_VERIFIED",
    label: "Measurements checked",
    message: "Your measurements are checked and good.",
  },
  {
    key: "CUTTING",
    label: "Being cut",
    message: "Your cloth is being cut.",
  },
  {
    key: "STITCHING",
    label: "With the karigar",
    message: "Being stitched by hand now.",
  },
  {
    key: "EMBROIDERY",
    label: "Embroidery",
    message: "Detail work is underway.",
  },
  {
    key: "FINISHING",
    label: "Final touches",
    message: "Finishing and pressing.",
  },
  {
    key: "QUALITY_CHECK",
    label: "Final check",
    message: "A last check before it leaves.",
  },
  {
    key: "PACKED",
    label: "Packed",
    message: "Packed and ready to leave.",
  },
  {
    key: "DISPATCHED",
    label: "On its way",
    message: "On its way to you.",
  },
  {
    key: "DELIVERED",
    label: "Delivered",
    message: "Delivered — wear it well.",
  },
  {
    key: "COMPLETED",
    label: "Complete",
    message: "Order complete.",
  },
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
    message: def.message,
    state: timelineStepState(def.key, current),
    skipped: def.key === "EMBROIDERY" && input.skipEmbroidery,
  }));
}
