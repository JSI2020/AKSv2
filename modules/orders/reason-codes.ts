/** Cancellation reason codes — selected from dropdown, never free-typed twice. */
export const ORDER_CANCEL_REASONS = [
  { code: "CUSTOMER_CHANGED_MIND", label: "Customer changed mind" },
  { code: "WRONG_SIZE", label: "Wrong size or measurements" },
  { code: "FABRIC_UNAVAILABLE", label: "Fabric unavailable" },
  { code: "PRICE_DISAGREEMENT", label: "Price disagreement" },
  { code: "DUPLICATE_ORDER", label: "Duplicate order" },
  { code: "DELIVERY_ISSUE", label: "Delivery issue" },
  { code: "OTHER", label: "Other" },
] as const;

export type OrderCancelReasonCode =
  (typeof ORDER_CANCEL_REASONS)[number]["code"];

/** Price adjustment reason codes. */
export const ORDER_PRICE_ADJUSTMENT_REASONS = [
  { code: "LOYALTY_DISCOUNT", label: "Loyalty discount" },
  { code: "PROMOTION", label: "Promotion applied" },
  { code: "MEASUREMENT_CHANGE", label: "Measurement change" },
  { code: "FABRIC_UPGRADE", label: "Fabric upgrade" },
  { code: "SHIPPING_ADJUSTMENT", label: "Shipping adjustment" },
  { code: "GOODWILL", label: "Goodwill gesture" },
  { code: "OTHER", label: "Other" },
] as const;

export type OrderPriceAdjustmentReasonCode =
  (typeof ORDER_PRICE_ADJUSTMENT_REASONS)[number]["code"];

export function cancelReasonLabel(code: string): string {
  return (
    ORDER_CANCEL_REASONS.find((r) => r.code === code)?.label ?? code
  );
}

export function priceAdjustmentReasonLabel(code: string): string {
  return (
    ORDER_PRICE_ADJUSTMENT_REASONS.find((r) => r.code === code)?.label ?? code
  );
}

export const ORDER_PAYMENT_PROVIDERS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "EASYPAISA", label: "Easypaisa" },
  { value: "COD", label: "Cash on delivery" },
  { value: "SAFEPAY", label: "Safepay" },
  { value: "OTHER", label: "Other" },
] as const;
