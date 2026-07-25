import type { PakistanProvince } from "@aks/db";

import type { PaymentPlan } from "@/modules/checkout/payment-plans";

export const MANUAL_ORDER_SOURCES = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "PHONE", label: "Phone" },
  { value: "WALK_IN", label: "Walk-in" },
] as const;

export type ManualOrderSource =
  (typeof MANUAL_ORDER_SOURCES)[number]["value"];

/** Deposit providers offered at manual order entry. */
export const MANUAL_DEPOSIT_PROVIDERS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "JAZZCASH", label: "JazzCash (wallet)" },
  { value: "EASYPAISA", label: "Easypaisa (wallet)" },
] as const;

export type ManualDepositProvider =
  (typeof MANUAL_DEPOSIT_PROVIDERS)[number]["value"];

export type ManualOrderCustomerInput =
  | {
      mode: "existing";
      userId: string;
    }
  | {
      mode: "new";
      name: string;
      email?: string;
      phone: string;
      whatsappNumber: string;
    };

export type ManualOrderAddressInput = {
  recipientName: string;
  phone: string;
  whatsappNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: PakistanProvince;
  postalCode?: string;
  landmark?: string;
};

export type ManualOrderLineInput = {
  designId: string;
  colourwayId: string;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  /** componentKey:measurementKey → hundredths of an inch */
  measurements: Record<string, number>;
  customizationSelections: Record<string, string | boolean>;
  quantity: number;
};

export type ManualOrderPriceAdjustment = {
  newTotalMinor: number;
  reasonCode: string;
  note?: string;
};

export type ManualOrderDepositInput = {
  amountMinor: number;
  provider: ManualDepositProvider;
  note?: string;
};

export type PlaceManualOrderInput = {
  source: ManualOrderSource;
  customer: ManualOrderCustomerInput;
  address: ManualOrderAddressInput;
  lines: ManualOrderLineInput[];
  paymentPlan: PaymentPlan;
  priceAdjustment?: ManualOrderPriceAdjustment;
  deposit?: ManualOrderDepositInput;
  customerNotes?: string;
  internalNotes?: string;
};

export type PlaceManualOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; error: string };

export type CustomerSearchResult = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
};

export type ManualOrderDesignOption = {
  id: string;
  slug: string;
  name: string;
  basePriceMinor: number;
};

export type ManualOrderDesignDetail = {
  id: string;
  slug: string;
  name: string;
  basePriceMinor: number;
  madeToMeasureSurchargeMinor: number;
  sizeBlockId: string | null;
  components: string[];
  garmentCategoryKey: string;
  colourways: {
    id: string;
    name: string;
    priceDeltaMinor: number;
    isDefault: boolean;
  }[];
  customizationOptions: {
    key: string;
    label: string;
    inputType: "SELECT" | "BOOLEAN";
    required: boolean;
    values: {
      value: string;
      label: string;
      priceDeltaMinor: number;
    }[];
  }[];
  sizeLabels: string[];
};
