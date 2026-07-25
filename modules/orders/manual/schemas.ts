import type { PakistanProvince } from "@aks/db";

import { PAKISTAN_PROVINCES } from "@/modules/checkout/payment-plans";
import { isPaymentPlanAllowed } from "@/modules/checkout/payment-plans";
import { priceAdjustmentReasonLabel } from "@/modules/orders/reason-codes";

import {
  MANUAL_DEPOSIT_PROVIDERS,
  MANUAL_ORDER_SOURCES,
  type ManualOrderAddressInput,
  type ManualOrderCustomerInput,
  type ManualOrderDepositInput,
  type ManualOrderLineInput,
  type ManualOrderPriceAdjustment,
  type ManualOrderSource,
  type PlaceManualOrderInput,
} from "./types";

const PROVINCE_SET = new Set(PAKISTAN_PROVINCES.map((p) => p.value));
const SOURCE_SET = new Set(MANUAL_ORDER_SOURCES.map((s) => s.value));
const DEPOSIT_PROVIDER_SET = new Set(
  MANUAL_DEPOSIT_PROVIDERS.map((p) => p.value),
);

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateManualOrderAddress(
  input: ManualOrderAddressInput,
): { ok: true; data: ManualOrderAddressInput } | { ok: false; error: string } {
  const recipientName = trim(input.recipientName);
  if (recipientName.length < 2) {
    return { ok: false, error: "Enter the recipient name." };
  }

  const phone = digitsOnly(input.phone);
  if (phone.length < 10 || phone.length > 15) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  const whatsappNumber = digitsOnly(input.whatsappNumber);
  if (whatsappNumber.length < 10 || whatsappNumber.length > 15) {
    return { ok: false, error: "Enter a valid WhatsApp number." };
  }

  const addressLine1 = trim(input.addressLine1);
  if (addressLine1.length < 3) {
    return { ok: false, error: "Enter house or flat and street." };
  }

  const city = trim(input.city);
  if (city.length < 2) {
    return { ok: false, error: "Enter the city." };
  }

  if (!PROVINCE_SET.has(input.province)) {
    return { ok: false, error: "Select a province." };
  }

  return {
    ok: true,
    data: {
      recipientName,
      phone,
      whatsappNumber,
      addressLine1,
      addressLine2: trim(input.addressLine2) || undefined,
      city,
      province: input.province as PakistanProvince,
      postalCode: trim(input.postalCode) || undefined,
      landmark: trim(input.landmark) || undefined,
    },
  };
}

export function validateManualOrderCustomer(
  input: ManualOrderCustomerInput,
): { ok: true; data: ManualOrderCustomerInput } | { ok: false; error: string } {
  if (input.mode === "existing") {
    if (!input.userId.trim()) {
      return { ok: false, error: "Select a customer or create a new one." };
    }
    return { ok: true, data: input };
  }

  const name = trim(input.name);
  if (name.length < 2) {
    return { ok: false, error: "Enter the customer name." };
  }

  const phone = digitsOnly(input.phone);
  if (phone.length < 10 || phone.length > 15) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  const whatsappNumber = digitsOnly(input.whatsappNumber);
  if (whatsappNumber.length < 10 || whatsappNumber.length > 15) {
    return { ok: false, error: "Enter a valid WhatsApp number." };
  }

  const email = trim(input.email);
  if (email && !email.includes("@")) {
    return { ok: false, error: "Enter a valid email, or leave it blank." };
  }

  return {
    ok: true,
    data: {
      mode: "new",
      name,
      email: email || undefined,
      phone,
      whatsappNumber,
    },
  };
}

export function validateManualOrderLine(
  line: ManualOrderLineInput,
): { ok: true; data: ManualOrderLineInput } | { ok: false; error: string } {
  if (!line.designId || !line.colourwayId) {
    return { ok: false, error: "Each line needs a design and colourway." };
  }

  if (line.quantity < 1 || line.quantity > 99) {
    return { ok: false, error: "Quantity must be between 1 and 99." };
  }

  if (line.sizeMode === "STANDARD") {
    if (!line.sizeLabel?.trim()) {
      return { ok: false, error: "Select a standard size for each line." };
    }
  } else if (Object.keys(line.measurements).length === 0) {
    return { ok: false, error: "Enter measurements for made-to-measure lines." };
  }

  return { ok: true, data: line };
}

export function validateManualOrderDeposit(
  deposit: ManualOrderDepositInput | undefined,
  depositDueMinor: number,
):
  | { ok: true; data: ManualOrderDepositInput | undefined }
  | { ok: false; error: string } {
  if (!deposit) return { ok: true, data: undefined };

  if (deposit.amountMinor <= 0) {
    return { ok: false, error: "Deposit amount must be greater than zero." };
  }

  if (deposit.amountMinor > depositDueMinor) {
    return {
      ok: false,
      error: "Deposit cannot exceed the amount due now.",
    };
  }

  if (!DEPOSIT_PROVIDER_SET.has(deposit.provider)) {
    return { ok: false, error: "Select how the deposit was received." };
  }

  return { ok: true, data: deposit };
}

export function validateManualOrderPriceAdjustment(
  adjustment: ManualOrderPriceAdjustment | undefined,
  computedTotalMinor: number,
):
  | { ok: true; data: ManualOrderPriceAdjustment | undefined }
  | { ok: false; error: string } {
  if (!adjustment) return { ok: true, data: undefined };

  if (adjustment.newTotalMinor <= 0) {
    return { ok: false, error: "Adjusted total must be greater than zero." };
  }

  if (adjustment.newTotalMinor === computedTotalMinor) {
    return { ok: true, data: undefined };
  }

  if (!adjustment.reasonCode.trim()) {
    return { ok: false, error: "Select a reason for the price adjustment." };
  }

  priceAdjustmentReasonLabel(adjustment.reasonCode);

  return { ok: true, data: adjustment };
}

export function validatePlaceManualOrderInput(
  input: PlaceManualOrderInput,
  computedTotalMinor: number,
  depositDueMinor: number,
):
  | { ok: true; source: ManualOrderSource }
  | { ok: false; error: string } {
  if (!SOURCE_SET.has(input.source)) {
    return { ok: false, error: "Select where this sale came from." };
  }

  const customerResult = validateManualOrderCustomer(input.customer);
  if (!customerResult.ok) return customerResult;

  const addressResult = validateManualOrderAddress(input.address);
  if (!addressResult.ok) return addressResult;

  if (input.lines.length === 0) {
    return { ok: false, error: "Add at least one item." };
  }

  for (const line of input.lines) {
    const lineResult = validateManualOrderLine(line);
    if (!lineResult.ok) return lineResult;
  }

  if (
    !isPaymentPlanAllowed(
      input.paymentPlan,
      input.lines.map((l) => ({ sizeMode: l.sizeMode })),
    )
  ) {
    return {
      ok: false,
      error:
        "Made-to-measure pieces cannot use the half-now plan. Choose 70% deposit or pay in full.",
    };
  }

  const adjustmentResult = validateManualOrderPriceAdjustment(
    input.priceAdjustment,
    computedTotalMinor,
  );
  if (!adjustmentResult.ok) return adjustmentResult;

  const depositResult = validateManualOrderDeposit(input.deposit, depositDueMinor);
  if (!depositResult.ok) return depositResult;

  return { ok: true, source: input.source };
}
