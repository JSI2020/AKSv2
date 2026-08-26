import type { SizeMode } from "@/modules/catalog/types";

export type CartCustomizationSelections = Record<string, string | boolean>;

export type CartLinePublic = {
  id: string;
  designId: string;
  designSlug: string;
  designName: string;
  colourwayId: string;
  colourwayName: string;
  sizeMode: SizeMode;
  sizeLabel: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  thumbnailUrl: string | null;
  leadTimeDays: number | null;
};

export type CartPublic = {
  id: string;
  lines: CartLinePublic[];
  itemCount: number;
  subtotalMinor: number;
  leadTimeLabel: string;
};

export type AddToCartInput = {
  designId: string;
  colourwayId: string;
  sizeMode: SizeMode;
  sizeLabel: string | null;
  measurementProfileId: string | null;
  customizationSelections: CartCustomizationSelections;
  quantity: number;
};

export type AddToCartResult =
  | { ok: true; cart: CartPublic; lineId: string }
  | { ok: false; error: string };

export type CartMutationResult =
  | { ok: true; cart: CartPublic }
  | { ok: false; error: string };

export function cartLineFingerprint(input: {
  designId: string;
  colourwayId: string;
  sizeMode: SizeMode;
  sizeLabel: string | null;
  measurementProfileId: string | null;
  customizationSelections: CartCustomizationSelections;
}): string {
  const selections = Object.keys(input.customizationSelections ?? {})
    .sort()
    .reduce<CartCustomizationSelections>((acc, key) => {
      acc[key] = input.customizationSelections[key]!;
      return acc;
    }, {});

  return JSON.stringify({
    designId: input.designId,
    colourwayId: input.colourwayId,
    sizeMode: input.sizeMode,
    sizeLabel: input.sizeLabel?.trim() || null,
    // Standard sizes never key off a measurement profile.
    measurementProfileId:
      input.sizeMode === "STANDARD" ? null : input.measurementProfileId,
    customizationSelections: selections,
  });
}

export function formatCartLeadTime(maxDays: number | null): string {
  if (maxDays != null) {
    return `Ready to wear — ships in about ${maxDays} days after checkout.`;
  }
  return "Ready to wear — ships in about 3–5 days after checkout.";
}
