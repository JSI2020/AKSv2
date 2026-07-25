import { describe, expect, it } from "vitest";

import {
  computeDiscountAmountParts,
  formatPreviewSentence,
  previewDiscountOnSampleOrder,
  selectAppliedDiscounts,
} from "./compute";

describe("discount compute", () => {
  it("previews a 15% welcome discount on a PKR 30,000 sample order", () => {
    const preview = previewDiscountOnSampleOrder(
      {
        type: "PERCENTAGE",
        value: 15,
        minSpendMinor: 25_000_00,
        maxDiscountMinor: null,
      },
      30_000_00,
    );

    expect(preview.discountMinor).toBe(4_500_00);
    expect(preview.totalMinor).toBe(25_500_00);
    expect(formatPreviewSentence(30_000_00, preview.totalMinor)).toBe(
      "A PKR 30,000 order would pay PKR 25,500",
    );
  });

  it("applies deposit math to the discounted total", () => {
    const preview = previewDiscountOnSampleOrder(
      {
        type: "PERCENTAGE",
        value: 15,
        minSpendMinor: 0,
        maxDiscountMinor: null,
      },
      30_000_00,
    );

    const deposit = Math.round((preview.totalMinor * 70) / 100);
    expect(deposit).toBe(17_850_00);
  });

  it("chooses the best non-stackable discount", () => {
    const selected = selectAppliedDiscounts([
      {
        discount: {
          stackable: false,
        } as never,
        parts: {
          lineDiscountMinor: 2_000_00,
          shippingDiscountMinor: 0,
          totalDiscountMinor: 2_000_00,
        },
      },
      {
        discount: {
          stackable: false,
        } as never,
        parts: {
          lineDiscountMinor: 4_500_00,
          shippingDiscountMinor: 0,
          totalDiscountMinor: 4_500_00,
        },
      },
    ]);

    expect(selected).toHaveLength(1);
    expect(selected[0]?.parts.totalDiscountMinor).toBe(4_500_00);
  });

  it("respects maxDiscountMinor cap", () => {
    const parts = computeDiscountAmountParts(
      {
        type: "PERCENTAGE",
        value: 20,
        maxDiscountMinor: 3_000_00,
      },
      30_000_00,
      0,
    );

    expect(parts.totalDiscountMinor).toBe(3_000_00);
  });
});
