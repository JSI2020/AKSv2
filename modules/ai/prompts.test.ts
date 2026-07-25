import { describe, expect, it } from "vitest";

import { buildSketchToPhotoPrompt } from "./prompts";

const mockHouseModel = {
  buildDescription: "Balanced house default.",
  heightCm: 170,
  heightInches: 6700,
};

const sampleVars = {
  garmentDescription: "Two-piece shalwar kameez with straight trouser.",
  shirtColour: "dusty rose",
  shirtFabric: "premium cotton lawn",
  trouserColour: "ivory",
  trouserFabric: "cotton cambric",
  embroideryDescription: "gold zari threadwork at neckline and cuffs",
  angle: "front full length",
  houseModel: mockHouseModel,
};

describe("sketch-to-photo prompt v1", () => {
  it("assembles a complete readable prompt with fixed phrases and variables", () => {
    const { prompt, negative, templateVersion } =
      buildSketchToPhotoPrompt(sampleVars);

    expect(templateVersion).toBe(1);

    expect(prompt).toContain(
      "Photorealistic fashion e-commerce photograph reproducing the garment precisely as drawn in the attached sketch, without redesigning or omitting any detail.",
    );
    expect(prompt).toContain("Two-piece shalwar kameez with straight trouser.");
    expect(prompt).toContain("dusty rose premium cotton lawn");
    expect(prompt).toContain("ivory cotton cambric");
    expect(prompt).toContain(
      "gold zari threadwork at neckline and cuffs",
    );
    expect(prompt).toContain("Balanced house default.");
    expect(prompt).toContain("5'7″ (170 cm)");
    expect(prompt).toContain(
      "Clean studio, seamless warm-greige background, soft diffused daylight",
    );
    expect(prompt).toContain("85mm lens look");
    expect(prompt).toContain(
      "high-end modest fashion catalog photography, realistic not stylised",
    );
    expect(prompt).toContain("Angle: front full length.");

    expect(negative).toContain("no text");
    expect(negative).toContain("no logo");
    expect(negative).toContain("no altered neckline or hem");
    expect(negative).toContain("no oversaturation");
    expect(negative).toContain("no colour bleed between garment pieces");
    expect(negative).toContain("no distortion of embroidery");
    expect(negative).toContain("no Western dress");
  });

  it("uses backdrop override when provided", () => {
    const { prompt } = buildSketchToPhotoPrompt({
      ...sampleVars,
      backdrop: "Warm ivory cyclorama, north-window daylight.",
    });
    expect(prompt).toContain("Warm ivory cyclorama, north-window daylight.");
    expect(prompt).not.toContain("seamless warm-greige background");
  });
});
