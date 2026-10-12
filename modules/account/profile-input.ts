import type { PakistanProvince } from "@aks/db";

import { PAKISTAN_PROVINCES } from "@/modules/checkout/payment-plans";
import { isHousePlaceholderEmail } from "@/modules/auth/social/identity";

const PROVINCES = new Set(PAKISTAN_PROVINCES.map((item) => item.value));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDisplayName(
  raw: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Enter your name." };
  if (name.length > 80) return { ok: false, error: "Use a shorter name." };
  return { ok: true, name };
}

export function validateAccountPhone(
  raw: string,
): { ok: true; phone: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, phone: null };
  const phone = trimmed.replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  return { ok: true, phone };
}

export function validateAccountEmail(
  raw: string,
): { ok: true; email: string } | { ok: false; error: string } {
  const email = raw.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (isHousePlaceholderEmail(email)) {
    return { ok: false, error: "Enter an email you can read." };
  }
  return { ok: true, email };
}

export type SavedAddressInput = {
  label?: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode?: string;
  landmark?: string;
  isDefault?: boolean;
};

export type SavedAddress = {
  label: string | null;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: PakistanProvince;
  postalCode: string | null;
  landmark: string | null;
  isDefault: boolean;
};

export function validateSavedAddress(
  input: SavedAddressInput,
): { ok: true; data: SavedAddress } | { ok: false; error: string } {
  const recipientName = input.recipientName.trim().replace(/\s+/g, " ");
  if (recipientName.length < 2) {
    return { ok: false, error: "Enter the recipient name." };
  }
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  const addressLine1 = input.addressLine1.trim();
  if (addressLine1.length < 3) {
    return { ok: false, error: "Enter house or flat and street." };
  }
  const city = input.city.trim();
  if (city.length < 2) return { ok: false, error: "Enter your city." };
  if (!PROVINCES.has(input.province as PakistanProvince)) {
    return { ok: false, error: "Select your province." };
  }
  const label = input.label?.trim() ?? "";
  return {
    ok: true,
    data: {
      label: label ? label.slice(0, 40) : null,
      recipientName: recipientName.slice(0, 80),
      phone,
      addressLine1: addressLine1.slice(0, 160),
      addressLine2: input.addressLine2?.trim().slice(0, 160) || null,
      city: city.slice(0, 80),
      province: input.province as PakistanProvince,
      postalCode: input.postalCode?.trim().slice(0, 16) || null,
      landmark: input.landmark?.trim().slice(0, 120) || null,
      isDefault: Boolean(input.isDefault),
    },
  };
}

export const DELETE_CONFIRMATION = "DELETE";

export function validateDeleteConfirmation(
  raw: string,
): { ok: true } | { ok: false; error: string } {
  if (raw.trim() !== DELETE_CONFIRMATION) {
    return { ok: false, error: "Type DELETE to confirm." };
  }
  return { ok: true };
}
