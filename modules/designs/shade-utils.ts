import { STANDARD_SIZE_LABELS } from "@aks/shared";

import {
  filterStorefrontRtwSizeLabels,
  withHouseSizeRange,
} from "@/modules/catalog/types";

type ShadeRow = {
  id: string;
  name: string;
  availableSizeLabels?: string[] | null;
};

type DesignSizes = {
  availableSizeLabels?: string[] | null;
};

/** Admin + storefront: sizes offered for one shade. */
export function resolveShadeSizeLabels(
  shade: ShadeRow,
  design: DesignSizes,
): string[] {
  let labels: string[];
  if (shade.availableSizeLabels?.length) {
    labels = [...shade.availableSizeLabels];
  } else if (design.availableSizeLabels?.length) {
    labels = [...design.availableSizeLabels];
  } else {
    labels = [...STANDARD_SIZE_LABELS];
  }
  return filterStorefrontRtwSizeLabels(withHouseSizeRange(labels));
}

export function shadeDisplayName(
  shade: { name: string },
  index: number,
): string {
  const trimmed = shade.name.trim();
  return trimmed || `Shade ${index + 1}`;
}

type ShadePriceRow = {
  basePriceMinor?: number | null;
  compareAtPriceMinor?: number | null;
  priceDeltaMinor?: number;
};

type DesignPriceRow = {
  basePriceMinor: number;
  compareAtPriceMinor?: number | null;
};

/** Retail price for one shade (Price tab / storefront). */
export function resolveShadePriceMinor(
  shade: ShadePriceRow,
  design: DesignPriceRow,
): number {
  if (shade.basePriceMinor != null && shade.basePriceMinor > 0) {
    return shade.basePriceMinor;
  }
  return design.basePriceMinor + (shade.priceDeltaMinor ?? 0);
}

export function resolveShadeCompareAtMinor(
  shade: ShadePriceRow,
  design: DesignPriceRow,
): number | null {
  if (shade.compareAtPriceMinor != null) {
    return shade.compareAtPriceMinor;
  }
  return design.compareAtPriceMinor ?? null;
}
