import { describe, expect, it } from "vitest";

import {
  applyHomography,
  homographyFromPoints,
  rectifierFromCard,
  type Point,
} from "./geometry";
import {
  calibrateWithCard,
  calibrateWithKnownHeight,
  measureIn,
} from "./calibrate";
import {
  ellipsePerimeter,
  flatLayGirthIn,
  onBodyGirthIn,
} from "./girth";
import { fuse, isConflicting, measurementEstimate } from "./fuse";
import { snapToSize } from "./size-snap";

/** A known projective distortion to simulate an angled photo. */
const TILT: Parameters<typeof homographyFromPoints>[0] = [
  { x: 120, y: 80 },
  { x: 980, y: 130 },
  { x: 940, y: 720 },
  { x: 90, y: 660 },
];

describe("geometry — perspective + scale from a calibration card", () => {
  it("recovers the card's own corners exactly", () => {
    // A4 sheet: 8.27 × 11.69 in, photographed at an angle (TILT corners).
    const rectify = rectifierFromCard(TILT, 8.27, 11.69);
    const tl = rectify(TILT[0]);
    const br = rectify(TILT[2]);
    expect(tl.x).toBeCloseTo(0, 6);
    expect(tl.y).toBeCloseTo(0, 6);
    expect(br.x).toBeCloseTo(8.27, 6);
    expect(br.y).toBeCloseTo(11.69, 6);
  });

  it("round-trips arbitrary points through a synthetic homography", () => {
    const h = homographyFromPoints(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      TILT,
    );
    // Map a grid point forward, then rectify it back with the inverse setup.
    const forward = applyHomography(h, { x: 50, y: 50 });
    const back = rectifierFromCard(TILT, 100, 100)(forward);
    expect(back.x).toBeCloseTo(50, 4);
    expect(back.y).toBeCloseTo(50, 4);
  });

  it("measures a flat-lay garment span in true inches despite perspective", () => {
    // Ground truth: a 22.75″ pit-to-pit span lying on the card's plane.
    // Build the world→image projection from the A4's true size, project the
    // pit points into the distorted photo, then measure with the calibration.
    const world: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 8.27, y: 0 },
      { x: 8.27, y: 11.69 },
      { x: 0, y: 11.69 },
    ];
    const project = homographyFromPoints(world, TILT);
    const pitL = applyHomography(project, { x: -6.0, y: 14.0 });
    const pitR = applyHomography(project, { x: 16.75, y: 14.0 });

    const cal = calibrateWithCard(TILT, 8.27, 11.69);
    const span = measureIn(cal, pitL, pitR);
    expect(span).toBeCloseTo(22.75, 3);
    // …and the finished chest girth is exactly double the flat width.
    expect(flatLayGirthIn(span)).toBeCloseTo(45.5, 2);
  });

  it("degenerate (collinear) calibration points are rejected", () => {
    expect(() =>
      homographyFromPoints(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
        TILT,
      ),
    ).toThrow();
  });
});

describe("girth models", () => {
  it("a circle's ellipse perimeter matches πd", () => {
    expect(ellipsePerimeter(10, 10)).toBeCloseTo(2 * Math.PI * 10, 3);
  });

  it("on-body girth from visible width uses the landmark's cross-section", () => {
    // 13″ visible waist width on a model → ellipse a=6.5, b=6.5×0.74.
    const girth = onBodyGirthIn(13, "waist");
    expect(girth).toBeGreaterThan(34);
    expect(girth).toBeLessThan(38); // a plausible waist, not a fantasy
  });

  it("known-height calibration converts pixel spans by stated height", () => {
    // 64″ model spans 1280px head-to-floor ⇒ 20 px/in.
    const cal = calibrateWithKnownHeight({ x: 0, y: 0 }, { x: 0, y: 1280 }, 64);
    expect(measureIn(cal, { x: 0, y: 0 }, { x: 300, y: 0 })).toBeCloseTo(15, 6);
  });
});

describe("fusion — photo evidence vs style prior", () => {
  it("a sharp measurement dominates a loose prior (and vice versa)", () => {
    const prior = { value: 4550, sd: 150 }; // template says 45.5″ ± 1.5″
    const sharp = measurementEstimate(44.0, 0.005, 0.015); // flat-lay + card
    const fusedSharp = fuse(prior, sharp);
    expect(Math.abs(fusedSharp.value - 4400)).toBeLessThan(30);

    const rough = measurementEstimate(44.0, 0.035, 0.05); // on-model, height-calibrated
    const fusedRough = fuse(prior, rough);
    // The rough photo moves the prior, but nowhere near all the way.
    expect(fusedRough.value).toBeGreaterThan(fusedSharp.value);
    expect(fusedRough.value).toBeLessThan(4550);
  });

  it("irreconcilable stories are flagged, not averaged silently", () => {
    const prior = { value: 4550, sd: 100 };
    const wildly = { value: 6000, sd: 100 };
    expect(isConflicting(prior, wildly)).toBe(true);
    expect(isConflicting(prior, { value: 4600, sd: 100 })).toBe(false);
  });
});

describe("size snap — measured garment onto the house grid", () => {
  const GRID = {
    S: { bust: 3450, waist: 2650, hip: 3650 },
    M: { bust: 3650, waist: 2850, hip: 3850 },
    L: { bust: 3850, waist: 3050, hip: 4050 },
  };

  it("finds the body the sample was cut for", () => {
    // Garment measured 40.5″ chest with ~4″ ease ⇒ body ≈ 36.5 = M.
    const snap = snapToSize({ bust: 3650, waist: 2900, hip: 3840 }, GRID);
    expect(snap?.size).toBe("M");
  });

  it("reports deltas so review can show 'runs large through the waist'", () => {
    const snap = snapToSize({ bust: 3650, waist: 3000, hip: 3850 }, GRID);
    expect(snap?.size).toBe("M");
    expect(snap?.deltas.waist).toBe(150); // +1.5″ vs the M body
  });
});
