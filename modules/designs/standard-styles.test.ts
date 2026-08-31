import { describe, expect, it } from "vitest";

import { CATEGORY_STYLES, findStylePreset, stylesForCategory } from "./standard-styles";

/**
 * Every garment category a design can be built in should offer standard styles,
 * otherwise "start from a standard style" is an empty dropdown and the only
 * route to a chart is a photo. The exceptions are deliberate: unstitched
 * yardage and flat drapes have no body block to grade.
 */
const NO_BODY_BLOCK = [
  "DUPATTA",
  "SHAWL",
  "SAREE",
  "UNSTITCHED_1PC",
  "UNSTITCHED_2PC",
  "UNSTITCHED_3PC",
  "CO_ORD_SET",
];

/** House categories that a real design gets built in. */
const TAILORED_CATEGORIES = [
  "A_LINE_SHIRT", "ABAYA", "ANARKALI", "ANGRAKHA", "BLOUSE_CHOLI", "CAPE",
  "CAPRI", "CULOTTE", "FROCK", "GHARARA", "GOWN", "JACKET", "KAFTAN",
  "KAMEEZ", "KURTA", "KURTI", "LEHENGA", "MAXI_DRESS", "PALAZZO", "PANT",
  "PESHWAAS", "SHALWAR", "SHARARA", "SHIRT", "SKIRT", "STRAIGHT_SHIRT",
  "TROUSER", "WAISTCOAT",
];

describe("standard style presets", () => {
  it("offers at least one style for every tailored category", () => {
    const missing = TAILORED_CATEGORIES.filter(
      (key) => stylesForCategory(key).length === 0,
    );
    expect(missing, `no standard styles for: ${missing.join(", ")}`).toEqual([]);
  });

  it("offers none for pieces with no body block to grade", () => {
    for (const key of NO_BODY_BLOCK) {
      expect(stylesForCategory(key), key).toEqual([]);
    }
  });

  it("matches categories case-insensitively", () => {
    expect(stylesForCategory("kameez").length).toBeGreaterThan(0);
    expect(stylesForCategory("Kameez").length).toBeGreaterThan(0);
  });

  it("keeps preset ids unique within a category and resolvable", () => {
    for (const [category, presets] of Object.entries(CATEGORY_STYLES)) {
      const ids = presets.map((p) => p.id);
      expect(new Set(ids).size, `${category} has duplicate ids`).toBe(ids.length);
      for (const preset of presets) {
        expect(findStylePreset(category, preset.id)?.label).toBe(preset.label);
      }
    }
  });

  it("only uses garment templates the sizing engine actually seeds", () => {
    const seeded = new Set([
      "short_shirt",
      "long_gown",
      "kurti",
      "vest_palazzo",
      "trouser",
    ]);
    for (const [category, presets] of Object.entries(CATEGORY_STYLES)) {
      for (const preset of presets) {
        expect(seeded.has(preset.key), `${category}/${preset.id} → ${preset.key}`).toBe(
          true,
        );
      }
    }
  });
});
