export const ORDER_STATUS_ALLOW = {
  DRAFT: ["AWAITING_DEPOSIT", "CANCELLED"],
  AWAITING_DEPOSIT: ["DEPOSIT_PAID", "CANCELLED"],
  DEPOSIT_PAID: ["MEASUREMENTS_CONFIRMED", "CANCELLED"],
  MEASUREMENTS_CONFIRMED: ["CUTTING", "REFUND_PENDING"],
  CUTTING: ["STITCHING", "REFUND_PENDING"],
  STITCHING: ["EMBROIDERY", "FINISHING", "REFUND_PENDING"],
  EMBROIDERY: ["FINISHING", "REFUND_PENDING"],
  FINISHING: ["QUALITY_CHECK", "REFUND_PENDING"],
  QUALITY_CHECK: ["READY_TO_SHIP", "FINISHING", "REFUND_PENDING"],
  READY_TO_SHIP: ["DISPATCHED", "REFUND_PENDING"],
  DISPATCHED: ["DELIVERED", "DELIVERY_REFUSED", "REFUND_PENDING"],
  DELIVERED: ["COMPLETED", "REFUND_PENDING"],
  COMPLETED: [],
  CANCELLED: [],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
  DELIVERY_REFUSED: ["WRITE_OFF"],
  WRITE_OFF: [],
  /** Legacy — not reachable after migration */
  IN_PRODUCTION: ["CUTTING", "REFUND_PENDING"],
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_ALLOW;

/** Guest checkout transitions use this actor until Step 29 links customers. */
export const CHECKOUT_GUEST_ACTOR_ID =
  "01900001-2345-7890-abcd-ef123456789b";

/** CUTTING is only legal from MEASUREMENTS_CONFIRMED (fabric lock gate). */
export const CUTTING_ENTRY_STATUS: OrderStatus = "MEASUREMENTS_CONFIRMED";

export function assertCuttingGate(from: OrderStatus, to: OrderStatus): void {
  if (to === "CUTTING" && from !== CUTTING_ENTRY_STATUS) {
    throw new Error(
      "Cutting cannot begin until measurements are confirmed — the fabric is cut to one customer only.",
    );
  }
}
