import type {
  discountAppliesToEnum,
  discountTypeEnum,
  discounts,
} from "@aks/db";

export type DiscountType = (typeof discountTypeEnum.enumValues)[number];
export type DiscountAppliesTo = (typeof discountAppliesToEnum.enumValues)[number];

export type DiscountRow = typeof discounts.$inferSelect;

export type DiscountLineInput = {
  designId: string;
  garmentTypeId: string;
  lineTotalMinor: number;
};

export type DiscountAmountParts = {
  lineDiscountMinor: number;
  shippingDiscountMinor: number;
  totalDiscountMinor: number;
};

export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase();
}

export function applicableSubtotalMinor(
  discount: Pick<DiscountRow, "appliesTo" | "targetIds">,
  lines: DiscountLineInput[],
  collectionDesignIds: ReadonlySet<string>,
): number {
  switch (discount.appliesTo) {
    case "ORDER":
      return lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    case "DESIGN":
      return lines
        .filter((line) => discount.targetIds.includes(line.designId))
        .reduce((sum, line) => sum + line.lineTotalMinor, 0);
    case "GARMENT_TYPE":
      return lines
        .filter((line) => discount.targetIds.includes(line.garmentTypeId))
        .reduce((sum, line) => sum + line.lineTotalMinor, 0);
    case "COLLECTION":
    case "CATEGORY":
      return lines
        .filter((line) => collectionDesignIds.has(line.designId))
        .reduce((sum, line) => sum + line.lineTotalMinor, 0);
    default:
      return 0;
  }
}

export function computeDiscountAmountParts(
  discount: Pick<DiscountRow, "type" | "value" | "maxDiscountMinor">,
  scopedSubtotalMinor: number,
  shippingMinor: number,
): DiscountAmountParts {
  switch (discount.type) {
    case "PERCENTAGE": {
      let lineDiscountMinor = Math.round(
        (scopedSubtotalMinor * discount.value) / 100,
      );
      if (discount.maxDiscountMinor != null) {
        lineDiscountMinor = Math.min(
          lineDiscountMinor,
          discount.maxDiscountMinor,
        );
      }
      return {
        lineDiscountMinor,
        shippingDiscountMinor: 0,
        totalDiscountMinor: lineDiscountMinor,
      };
    }
    case "FIXED_AMOUNT": {
      let lineDiscountMinor = Math.min(discount.value, scopedSubtotalMinor);
      if (discount.maxDiscountMinor != null) {
        lineDiscountMinor = Math.min(
          lineDiscountMinor,
          discount.maxDiscountMinor,
        );
      }
      return {
        lineDiscountMinor,
        shippingDiscountMinor: 0,
        totalDiscountMinor: lineDiscountMinor,
      };
    }
    case "FREE_SHIPPING":
      return {
        lineDiscountMinor: 0,
        shippingDiscountMinor: shippingMinor,
        totalDiscountMinor: shippingMinor,
      };
  }
}

export function isDiscountScheduled(
  discount: Pick<DiscountRow, "startsAt" | "endsAt">,
  now: Date,
): boolean {
  if (discount.startsAt && now < discount.startsAt) return false;
  if (discount.endsAt && now > discount.endsAt) return false;
  return true;
}

export function previewDiscountOnSampleOrder(
  discount: Pick<
    DiscountRow,
    "type" | "value" | "maxDiscountMinor" | "minSpendMinor"
  >,
  sampleSubtotalMinor = 30_000_00,
  sampleShippingMinor = 0,
): { discountMinor: number; totalMinor: number } {
  if (sampleSubtotalMinor < discount.minSpendMinor) {
    return { discountMinor: 0, totalMinor: sampleSubtotalMinor + sampleShippingMinor };
  }

  const parts = computeDiscountAmountParts(
    discount,
    sampleSubtotalMinor,
    sampleShippingMinor,
  );

  return {
    discountMinor: parts.totalDiscountMinor,
    totalMinor:
      sampleSubtotalMinor + sampleShippingMinor - parts.totalDiscountMinor,
  };
}

export type AppliedDiscountCandidate = {
  discount: DiscountRow;
  parts: DiscountAmountParts;
};

export function selectAppliedDiscounts(
  candidates: AppliedDiscountCandidate[],
): AppliedDiscountCandidate[] {
  if (candidates.length === 0) return [];

  const stackable = candidates.filter((c) => c.discount.stackable);
  const nonStackable = candidates.filter((c) => !c.discount.stackable);

  if (nonStackable.length > 0) {
    return [
      nonStackable.reduce((best, current) =>
        current.parts.totalDiscountMinor > best.parts.totalDiscountMinor
          ? current
          : best,
      ),
    ];
  }

  return stackable;
}

export function mergeDiscountParts(
  selected: AppliedDiscountCandidate[],
): DiscountAmountParts {
  return selected.reduce(
    (acc, item) => ({
      lineDiscountMinor: acc.lineDiscountMinor + item.parts.lineDiscountMinor,
      shippingDiscountMinor:
        acc.shippingDiscountMinor + item.parts.shippingDiscountMinor,
      totalDiscountMinor: acc.totalDiscountMinor + item.parts.totalDiscountMinor,
    }),
    {
      lineDiscountMinor: 0,
      shippingDiscountMinor: 0,
      totalDiscountMinor: 0,
    },
  );
}

export function formatPreviewSentence(
  sampleSubtotalMinor: number,
  totalMinor: number,
): string {
  const sampleMajor = Math.round(sampleSubtotalMinor / 100);
  const totalMajor = Math.round(totalMinor / 100);
  return `A PKR ${sampleMajor.toLocaleString("en-PK")} order would pay PKR ${totalMajor.toLocaleString("en-PK")}`;
}
