/** Shared CRM types — keep out of `"use server"` modules (Next only allows async exports there). */

export type DirectoryRowKind = "account" | "guest";

export type CustomerDirectoryRow = {
  kind: DirectoryRowKind;
  /** Account user id, or null for guest. */
  userId: string | null;
  /** Canonical phone digits for identity. */
  phoneDigits: string;
  name: string | null;
  email: string | null;
  phoneDisplay: string | null;
  firstContactSource: string | null;
  totalOrdersCount: number;
  lifetimeValueMinor: number;
  lastOrderAt: Date | null;
  href: string;
};

export type ListCustomerDirectoryResult = {
  rows: CustomerDirectoryRow[];
  duplicatePairCount: number;
};

export type PhoneMatchCandidate = {
  kind: DirectoryRowKind;
  userId: string | null;
  phoneDigits: string;
  name: string | null;
  phoneDisplay: string | null;
  totalOrdersCount: number;
  distance: number;
  href: string;
};

export type CustomerDetailOrder = {
  id: string;
  orderNumber: string;
  placedAt: Date | null;
  totalMinor: number;
  status: string;
  source: string;
  productionLabel: string;
};

export type CustomerDetailAddress = {
  recipientName: string;
  phone: string;
  lines: string[];
};

export type CustomerDetail = {
  kind: DirectoryRowKind;
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  phoneDigits: string;
  firstContactSource: string | null;
  lifetimeValueMinor: number;
  totalOrdersCount: number;
  codRefusalCount: number;
  lastOrderAt: Date | null;
  orders: CustomerDetailOrder[];
  measurementProfiles: {
    id: string;
    label: string;
    categoryName: string;
    isDefault: boolean;
    updatedAt: Date;
  }[];
  contactAddress: CustomerDetailAddress | null;
  mergeHref: string | null;
};

export type MergeCandidate = {
  ref: string;
  kind: DirectoryRowKind;
  userId: string | null;
  phoneDigits: string;
  name: string | null;
  phoneDisplay: string | null;
  firstContactSource: string | null;
  totalOrdersCount: number;
  lifetimeValueMinor: number;
  addressSummary: string | null;
};

export type CustomerActionResult =
  | { ok: true; userId: string; href: string }
  | { ok: false; error: string };
