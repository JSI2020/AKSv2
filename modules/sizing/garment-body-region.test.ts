import { describe, expect, it } from "vitest";

import { bodyRegionForCategory, supportsGhostMannequin } from "@aks/shared";

/**
 * The ghost mannequin is an upper-body form — it holds a shoulder line, an
 * armhole and a neckline. Anything worn from the waist down has none of those,
 * so it must not be sent for a ghost render.
 */
describe("garment body region", () => {
  it("classifies bottoms as lower body", () => {
    for (const key of [
      "TROUSER",
      "PANT",
      "PALAZZO",
      "SHALWAR",
      "CAPRI",
      "CULOTTE",
      "SHARARA",
      "GHARARA",
      "SKIRT",
      "LEHENGA",
    ]) {
      expect(bodyRegionForCategory(key), key).toBe("lower");
      expect(supportsGhostMannequin(key), key).toBe(false);
    }
  });

  it("classifies everything that hangs from the shoulders as upper body", () => {
    for (const key of [
      "KAMEEZ",
      "KURTA",
      "KURTI",
      "SHIRT",
      "A_LINE_SHIRT",
      "ANGRAKHA",
      "ABAYA",
      "ANARKALI",
      "KAFTAN",
      "MAXI_DRESS",
      "GOWN",
      "WAISTCOAT",
      "JACKET",
      "CAPE",
    ]) {
      expect(bodyRegionForCategory(key), key).toBe("upper");
      expect(supportsGhostMannequin(key), key).toBe(true);
    }
  });

  it("treats yardage and flat drapes as neither", () => {
    for (const key of [
      "DUPATTA",
      "SHAWL",
      "SAREE",
      "UNSTITCHED_2PC",
    ]) {
      expect(bodyRegionForCategory(key), key).toBe("none");
      expect(supportsGhostMannequin(key), key).toBe(false);
    }
  });

  it("is case and whitespace insensitive", () => {
    expect(supportsGhostMannequin(" kameez ")).toBe(true);
    expect(supportsGhostMannequin("Palazzo")).toBe(false);
  });
});
