import type { PakistanProvince } from "@aks/db";

import { PAKISTAN_PROVINCES } from "./payment-plans";
import type { CheckoutAddressInput } from "./types";

const PROVINCE_SET = new Set(PAKISTAN_PROVINCES.map((p) => p.value));

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateCheckoutAddress(
  input: CheckoutAddressInput,
): { ok: true; data: CheckoutAddressInput } | { ok: false; error: string } {
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
    return {
      ok: false,
      error: "Enter the WhatsApp number where we should send order updates.",
    };
  }

  const addressLine1 = trim(input.addressLine1);
  if (addressLine1.length < 3) {
    return { ok: false, error: "Enter house or flat and street." };
  }

  const city = trim(input.city);
  if (city.length < 2) {
    return { ok: false, error: "Enter your city." };
  }

  if (!PROVINCE_SET.has(input.province)) {
    return { ok: false, error: "Select your province." };
  }

  const guestEmail = trim(input.guestEmail);
  if (guestEmail && !guestEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email, or leave it blank." };
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
      guestEmail: guestEmail || undefined,
      saveAddress: input.saveAddress,
      addressLabel: trim(input.addressLabel) || undefined,
    },
  };
}

export function validatePaymentPlan(
  plan: string,
): { ok: true; plan: import("./payment-plans").PaymentPlan } | { ok: false; error: string } {
  if (
    plan === "FULL_PREPAID" ||
    plan === "DEPOSIT_50_COD_50" ||
    plan === "DEPOSIT_70_COD_30"
  ) {
    return { ok: true, plan };
  }
  return { ok: false, error: "Choose how you would like to pay." };
}
