import { describe, expect, it } from "vitest";

import {
  filterStorefrontRtwSizeLabels,
  houseSizeRangeCopy,
  STOREFRONT_RTW_SIZE_LABELS,
  withHouseSizeRange,
} from "./types";

describe("house size range", () => {
  it("offers XS through XXL", () => {
    expect(STOREFRONT_RTW_SIZE_LABELS).toEqual([
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
    ]);
  });

  it("expands a saved XS–XL list and leaves other subsets alone", () => {
    expect(withHouseSizeRange(["XS", "S", "M", "L", "XL"])).toEqual([
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
    ]);
    expect(withHouseSizeRange(["S", "M", "L"])).toEqual(["S", "M", "L"]);
    expect(withHouseSizeRange(["One size"])).toEqual(["One size"]);
  });

  it("rewrites the old house line without touching other ranges", () => {
    expect(houseSizeRangeCopy("standard sizes XS–XL.")).toBe(
      "standard sizes XS–XXL.",
    );
    expect(houseSizeRangeCopy("Choose XS to XL")).toBe("Choose XS to XXL");
    expect(houseSizeRangeCopy("measured XXS-XL")).toBe("measured XXS-XL");
  });

  it("keeps XXL and drops sizes above the house range", () => {
    expect(
      filterStorefrontRtwSizeLabels(["XS", "S", "M", "L", "XL", "XXL", "3XL"]),
    ).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
  });
});
