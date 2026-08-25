/** Maps order `toStatus` → message template key. Safe for client imports. */
export const ORDER_STATUS_TEMPLATE_KEYS: Record<string, string> = {
  AWAITING_DEPOSIT: "order.received",
  DEPOSIT_PAID: "order.confirmed",
  MEASUREMENTS_CONFIRMED: "order.measurements_verified",
  CUTTING: "order.cutting",
  STITCHING: "order.stitching",
  EMBROIDERY: "order.embroidery",
  FINISHING: "order.finishing",
  QUALITY_CHECK: "order.quality_check",
  READY_TO_SHIP: "order.packed",
  DISPATCHED: "order.dispatched",
  DELIVERED: "order.delivered",
  COMPLETED: "order.completed",
  CANCELLED: "order.cancelled",
  REFUND_PENDING: "order.refund_pending",
  REFUNDED: "order.refunded",
  DELIVERY_REFUSED: "order.delivery_refused",
};
