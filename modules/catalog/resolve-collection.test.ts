import { describe, expect, it } from "vitest";

import {
  isOccasionValue,
  isWorkValue,
  slugToCatalogueValue,
  titleFromTagValue,
} from "./types";
import { resolveCollection } from "./resolve-collection";

describe("catalog slug helpers", () => {
  it("maps kebab slugs to catalogue values", () => {
    expect(slugToCatalogueValue("semi-formal")).toBe("SEMI_FORMAL");
    expect(slugToCatalogueValue("wedding-guest")).toBe("WEDDING_GUEST");
  });

  it("titles tag values for display", () => {
    expect(titleFromTagValue("SEMI_FORMAL")).toBe("Semi Formal");
  });

  it("recognises occasion and work catalogues", () => {
    expect(isOccasionValue("FORMAL")).toBe(true);
    expect(isOccasionValue("FUSION")).toBe(false);
    expect(isWorkValue("ZARI")).toBe(true);
  });
});

describe("resolveCollection", () => {
  it("resolves new arrivals as a system collection", async () => {
    const c = await resolveCollection("new");
    expect(c?.kind).toBe("system");
    if (c?.kind === "system") {
      expect(c.system).toBe("new_arrivals");
      expect(c.baseFilters.publishedWithinDays).toBe(30);
    }
  });

  it("resolves formal as an occasion attribute filter", async () => {
    const c = await resolveCollection("formal");
    expect(c?.kind).toBe("attribute");
    expect(c?.baseFilters.occasion).toEqual(["FORMAL"]);
  });

  it("resolves embroidered as a work attribute filter", async () => {
    const c = await resolveCollection("embroidered");
    expect(c?.baseFilters.work).toEqual(["EMBROIDERED"]);
  });
});
