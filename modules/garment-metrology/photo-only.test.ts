import { describe, expect, it } from "vitest";

import { estimateFromPhoto } from "./photo-only";
import {
  landmarkAnchorsYBp,
  validateLandmarks,
  type GarmentLandmarks,
} from "./landmarks";
import type { Estimate } from "./fuse";

/**
 * A flat-laid kurta, photographed square-on.
 * Ground truth built into the coordinates:
 *   length span  = 0.10 → 0.90 of a 1000px image = 800px
 *   pit-to-pit   = 0.25 → 0.75 of a 1000px image = 500px
 * With a 44" length prior anchoring scale: ppi = 800/44 = 18.1818…
 *   flat chest width = 500 / 18.1818 = 27.5"  ⇒  girth = 2 × 27.5 = 55.0"
 */
const FLAT_LAY: GarmentLandmarks = {
  captureContext: "flat_lay",
  shoulderL: { x: 0.3, y: 0.1 },
  shoulderR: { x: 0.7, y: 0.1 },
  pitL: { x: 0.25, y: 0.22 },
  pitR: { x: 0.75, y: 0.22 },
  hemL: { x: 0.25, y: 0.9 },
  hemR: { x: 0.75, y: 0.9 },
};

const LENGTH_PRIOR: Estimate = { value: 4400, sd: 200 };

describe("photo-only estimation — scale anchored on priors", () => {
  it("recovers a flat-lay chest girth exactly from the length anchor", () => {
    const result = estimateFromPhoto({
      landmarks: FLAT_LAY,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: { garmentLength: LENGTH_PRIOR },
    });

    expect(result.anchor.kind).toBe("garment_length_prior");
    // 2 × 27.5" = 55.00", i.e. 5500 hundredths.
    expect(result.measured.chest!.value).toBe(5500);
    // No chest prior existed, so the photo value stands.
    expect(result.fused.chest!.value).toBe(5500);
  });

  it("uses the person's height as the anchor when someone is in frame", () => {
    // 64" model spans the full 1000px height ⇒ 15.625 px/in.
    // Shoulder 0.20 → hem 0.70 = 500px ⇒ 32.0" garment length.
    const onModel: GarmentLandmarks = {
      ...FLAT_LAY,
      captureContext: "on_model",
      shoulderL: { x: 0.4, y: 0.2 },
      shoulderR: { x: 0.6, y: 0.2 },
      pitL: { x: 0.38, y: 0.28 },
      pitR: { x: 0.62, y: 0.28 },
      hemL: { x: 0.38, y: 0.7 },
      hemR: { x: 0.62, y: 0.7 },
      personTop: { x: 0.5, y: 0.0 },
      personBottom: { x: 0.5, y: 1.0 },
    };

    const result = estimateFromPhoto({
      landmarks: onModel,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: {},
      personHeight: { value: 6400, sd: 250 }, // stated 64" model
    });

    expect(result.anchor.kind).toBe("person_height");
    expect(result.measured.garmentLength!.value).toBe(3200);
  });

  it("assumes a photographic model height, not the customer M height", () => {
    // The house grid's 64" describes a customer; a product-photo model is
    // taller. Assuming too short shrinks every measurement proportionally.
    const onModel: GarmentLandmarks = {
      ...FLAT_LAY,
      captureContext: "on_model",
      shoulderL: { x: 0.4, y: 0.2 },
      shoulderR: { x: 0.6, y: 0.2 },
      pitL: { x: 0.38, y: 0.28 },
      pitR: { x: 0.62, y: 0.28 },
      hemL: { x: 0.38, y: 0.7 },
      hemR: { x: 0.62, y: 0.7 },
      personTop: { x: 0.5, y: 0.0 },
      personBottom: { x: 0.5, y: 1.0 },
    };
    const result = estimateFromPhoto({
      landmarks: onModel,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: {},
    });
    // Half the frame of a 68" model = 34.00", not the 32.00" a 64" grid gives.
    expect(result.measured.garmentLength!.value).toBe(3400);
  });

  it("is invariant to image resolution (normalized landmarks)", () => {
    const small = estimateFromPhoto({
      landmarks: FLAT_LAY,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: { garmentLength: LENGTH_PRIOR },
    });
    const large = estimateFromPhoto({
      landmarks: FLAT_LAY,
      imageWidthPx: 4000,
      imageHeightPx: 4000,
      prior: { garmentLength: LENGTH_PRIOR },
    });
    expect(large.measured.chest!.value).toBe(small.measured.chest!.value);
  });

  it("on-model girths are estimated (ellipse) and carry a wider error bar", () => {
    const onModel: GarmentLandmarks = {
      ...FLAT_LAY,
      captureContext: "on_model",
      personTop: { x: 0.5, y: 0.0 },
      personBottom: { x: 0.5, y: 1.0 },
    };
    const flat = estimateFromPhoto({
      landmarks: FLAT_LAY,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: { garmentLength: LENGTH_PRIOR },
    });
    const model = estimateFromPhoto({
      landmarks: onModel,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: { garmentLength: LENGTH_PRIOR },
    });
    const flatRel = flat.measured.chest!.sd / flat.measured.chest!.value;
    const modelRel = model.measured.chest!.sd / model.measured.chest!.value;
    expect(modelRel).toBeGreaterThan(flatRel);
  });

  it("fuses toward a nearby prior instead of replacing it", () => {
    const result = estimateFromPhoto({
      landmarks: FLAT_LAY,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: {
        garmentLength: LENGTH_PRIOR,
        chest: { value: 5300, sd: 150 },
      },
    });
    const fused = result.fused.chest!.value;
    expect(fused).toBeGreaterThan(5300);
    expect(fused).toBeLessThan(5500);
    expect(result.conflicts).not.toContain("chest");
  });

  it("flags a conflict instead of averaging an impossible disagreement", () => {
    const result = estimateFromPhoto({
      landmarks: FLAT_LAY,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: {
        garmentLength: LENGTH_PRIOR,
        chest: { value: 3600, sd: 100 }, // template says 36", photo says 55"
      },
    });
    expect(result.conflicts).toContain("chest");
    // Prior is kept — the engine never invents a midpoint between two stories.
    expect(result.fused.chest!.value).toBe(3600);
  });

  it("omits measurements whose landmarks were not detected", () => {
    const result = estimateFromPhoto({
      landmarks: FLAT_LAY, // no cuffs, no waist, no neck points
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: { garmentLength: LENGTH_PRIOR },
    });
    expect(result.measured.sleeveLength).toBeUndefined();
    expect(result.measured.waist).toBeUndefined();
    expect(result.measured.neckDrop).toBeUndefined();
  });

  it("drops girths when the pit points land on the sleeve edge, keeping lengths", () => {
    // shoulder span 0.20 of frame; pits reported at 0.44 = 2.2x — impossible
    // for an armhole seam, and exactly what happens when sleeves hang alongside.
    const sleeveEdge: GarmentLandmarks = {
      ...FLAT_LAY,
      shoulderL: { x: 0.4, y: 0.1 },
      shoulderR: { x: 0.6, y: 0.1 },
      pitL: { x: 0.28, y: 0.22 },
      pitR: { x: 0.72, y: 0.22 },
    };
    const result = estimateFromPhoto({
      landmarks: sleeveEdge,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: { garmentLength: LENGTH_PRIOR },
    });
    expect(result.measured.chest).toBeUndefined();
    expect(result.measured.hemWidth).toBeUndefined();
    // Lengths are unaffected by a bad pit reading.
    expect(result.measured.garmentLength).toBeDefined();
    expect(result.measured.shoulder).toBeDefined();
    expect(result.warnings.join(" ")).toMatch(/shoulder width/);
  });

  it("keeps girths when the pit line is anatomically plausible", () => {
    const ok: GarmentLandmarks = {
      ...FLAT_LAY,
      shoulderL: { x: 0.38, y: 0.1 },
      shoulderR: { x: 0.62, y: 0.1 },
      pitL: { x: 0.35, y: 0.22 },
      pitR: { x: 0.65, y: 0.22 },
    };
    const result = estimateFromPhoto({
      landmarks: ok,
      imageWidthPx: 1000,
      imageHeightPx: 1000,
      prior: { garmentLength: LENGTH_PRIOR },
    });
    expect(result.measured.chest).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it("refuses to guess when there is neither a person nor a length prior", () => {
    expect(() =>
      estimateFromPhoto({
        landmarks: FLAT_LAY,
        imageWidthPx: 1000,
        imageHeightPx: 1000,
        prior: {},
      }),
    ).toThrow(/person in frame or a garment-length prior/);
  });
});

describe("landmark validation — a bad detection never becomes a measurement", () => {
  it("accepts a well-formed set", () => {
    expect(validateLandmarks(FLAT_LAY).ok).toBe(true);
  });

  it("rejects broken vertical order (hem above the pit)", () => {
    const broken: GarmentLandmarks = {
      ...FLAT_LAY,
      hemL: { x: 0.25, y: 0.15 },
      hemR: { x: 0.75, y: 0.15 },
    };
    const v = validateLandmarks(broken);
    expect(v.ok).toBe(false);
    expect(v.errors.join(" ")).toMatch(/vertical order/);
  });

  it("rejects a mirrored pair and points outside the frame", () => {
    expect(
      validateLandmarks({ ...FLAT_LAY, pitL: { x: 0.9, y: 0.22 } }).ok,
    ).toBe(false);
    expect(
      validateLandmarks({ ...FLAT_LAY, hemR: { x: 1.4, y: 0.9 } }).ok,
    ).toBe(false);
  });

  it("warns (but accepts) when a pair is tilted by pose or perspective", () => {
    const tilted = validateLandmarks({
      ...FLAT_LAY,
      pitR: { x: 0.75, y: 0.32 },
    });
    expect(tilted.ok).toBe(true);
    expect(tilted.warnings.join(" ")).toMatch(/tilted/);
  });

  it("derives ghost-overlay anchors from the detected garment", () => {
    const anchors = landmarkAnchorsYBp({
      ...FLAT_LAY,
      waistL: { x: 0.28, y: 0.4 },
      waistR: { x: 0.72, y: 0.4 },
      neckFront: { x: 0.5, y: 0.14 },
    });
    expect(anchors.shoulder_line).toBe(1000); // y 0.10
    expect(anchors.bust_line).toBe(2200); // y 0.22 — the real pit line
    expect(anchors.waist_line).toBe(4000);
    expect(anchors.hip_line).toBe(6500); // midway waist → hem
    expect(anchors.hem).toBe(9000);
    expect(anchors.neck_front).toBe(1400);
  });
});
