import type { PakistanProvince, ShippingAddressSnapshot } from "@aks/db";

import type { PaymentPlan } from "./payment-plans";

export type CheckoutStep = "address" | "payment" | "review";

export type CheckoutAddressInput = {
  recipientName: string;
  phone: string;
  whatsappNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: PakistanProvince;
  postalCode?: string;
  landmark?: string;
  guestEmail?: string;
  saveAddress?: boolean;
  addressLabel?: string;
};

export type PlaceOrderInput = {
  address: CheckoutAddressInput;
  paymentPlan: PaymentPlan;
  customerNotes?: string;
  discountCode?: string | null;
};

export type CheckoutDiscountPreview = {
  code: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  depositAmountMinor: number;
  balanceAmountMinor: number;
};

export type ApplyCheckoutDiscountResult =
  | { ok: true; preview: CheckoutDiscountPreview }
  | { ok: false; error: string };

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; orderId: string }
  | { ok: false; error: string; issues?: string[] };

export function toShippingSnapshot(
  input: CheckoutAddressInput,
): ShippingAddressSnapshot {
  return {
    recipientName: input.recipientName.trim(),
    phone: input.phone.trim(),
    whatsappNumber: input.whatsappNumber.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || null,
    city: input.city.trim(),
    province: input.province,
    postalCode: input.postalCode?.trim() || null,
    landmark: input.landmark?.trim() || null,
  };
}

export type CheckoutPreview = {
  subtotalMinor: number;
  depositAmountMinor: number;
  balanceAmountMinor: number;
  paymentPlan: PaymentPlan;
  lines: {
    id: string;
    designName: string;
    colourwayName: string;
    sizeMode: "STANDARD" | "MADE_TO_MEASURE";
    sizeLabel: string | null;
    quantity: number;
    lineTotalMinor: number;
  }[];
};
