import type { PakistanProvince } from "@aks/db";

export type PaymentPlan =
  | "FULL_PREPAID"
  | "DEPOSIT_50_COD_50"
  | "DEPOSIT_70_COD_30";

export type CartLineForPlan = {
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
};

export type PaymentPlanOption = {
  plan: PaymentPlan;
  label: string;
  description: string;
  depositPercent: number;
  disabled: boolean;
  disabledReason?: string;
};

export function cartHasMadeToMeasure(lines: CartLineForPlan[]): boolean {
  return lines.some((line) => line.sizeMode === "MADE_TO_MEASURE");
}

export function getAvailablePaymentPlans(
  _lines: CartLineForPlan[],
  options?: { codDisabled?: boolean },
): PaymentPlanOption[] {
  const codDisabled = options?.codDisabled ?? false;

  return [
    {
      plan: "DEPOSIT_50_COD_50",
      label: "Half now, half on delivery",
      description:
        "Pay 50% now to confirm your order; pay the rest in cash when it arrives.",
      depositPercent: 50,
      disabled: codDisabled,
      disabledReason: codDisabled
        ? "Cash on delivery is not available on your account — pay in full upfront for your next order."
        : undefined,
    },
    {
      plan: "FULL_PREPAID",
      label: "Pay in full now",
      description:
        "Pay the full amount upfront. Nothing left to settle on delivery.",
      depositPercent: 100,
      disabled: false,
    },
  ];
}

export function isPaymentPlanAllowed(
  plan: PaymentPlan,
  lines: CartLineForPlan[],
  options?: { codDisabled?: boolean },
): boolean {
  // The 70/30 plan is retired (it existed only for made-to-measure).
  if (plan === "DEPOSIT_70_COD_30") {
    return false;
  }
  if (options?.codDisabled && plan !== "FULL_PREPAID") {
    return false;
  }
  if (plan === "DEPOSIT_50_COD_50" && cartHasMadeToMeasure(lines)) {
    return false;
  }
  return true;
}

export function computeDepositAmounts(input: {
  totalMinor: number;
  plan: PaymentPlan;
}): { depositAmountMinor: number; balanceAmountMinor: number } {
  const { totalMinor, plan } = input;

  let depositPercent: number;
  switch (plan) {
    case "FULL_PREPAID":
      depositPercent = 100;
      break;
    case "DEPOSIT_50_COD_50":
      depositPercent = 50;
      break;
    case "DEPOSIT_70_COD_30":
      depositPercent = 70;
      break;
    default:
      depositPercent = 100;
  }

  const depositAmountMinor = Math.round((totalMinor * depositPercent) / 100);
  const balanceAmountMinor = totalMinor - depositAmountMinor;

  return { depositAmountMinor, balanceAmountMinor };
}

export const DEPOSIT_POLICY_COPY =
  "Your deposit confirms the order and reserves your piece; the balance is due before it ships.";

export const PAKISTAN_PROVINCES: {
  value: PakistanProvince;
  label: string;
}[] = [
  { value: "PUNJAB", label: "Punjab" },
  { value: "SINDH", label: "Sindh" },
  { value: "KPK", label: "KPK" },
  { value: "BALOCHISTAN", label: "Balochistan" },
  { value: "GILGIT_BALTISTAN", label: "Gilgit-Baltistan" },
  { value: "AJK", label: "AJK" },
  { value: "ICT", label: "ICT" },
];

export function provinceLabel(province: PakistanProvince): string {
  return PAKISTAN_PROVINCES.find((p) => p.value === province)?.label ?? province;
}
