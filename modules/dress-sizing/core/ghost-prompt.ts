import type { GarmentType, LengthBand } from "../db/enums";
import type { NeckShape, SleeveStyle, StylePoints } from "./style-points";

const GARMENT: Record<GarmentType, string> = {
  short_shirt: "tunic shirt", long_gown: "long dress", kurti: "tunic",
  vest_palazzo: "long vest", trouser: "pair of trousers",
};
const HEM: Record<LengthBand, string> = {
  above_knee: "above-knee", knee: "knee-length", below_knee: "mid-calf",
  ankle: "ankle-length", floor: "floor-length",
};
const SLEEVE: Record<SleeveStyle, string> = {
  sleeveless: "sleeveless", cap: "cap", short: "short", elbow: "elbow-length",
  three_quarter: "three-quarter", full: "full-length",
};
const NECK: Record<NeckShape, string> = {
  high: "high", round: "round", boat: "boat", v: "V", keyhole: "keyhole", deep_v: "deep V",
};
function defaultSleeve(type: GarmentType): SleeveStyle {
  if (type === "vest_palazzo" || type === "trouser") return "sleeveless";
  return type === "short_shirt" ? "short" : "full";
}
/**
 * Measured geometry of the actual garment, as ratios of its shoulder-to-hem
 * length. Supplying these makes the ghost hold the REAL silhouette, which is
 * what lets the schematic measurement overlay land on the right places.
 */
export type GhostProportions = {
  /** chest (pit-to-pit) width ÷ garment length. */
  chestToLength?: number;
  /** hem width ÷ garment length. */
  hemToLength?: number;
  /** shoulder width ÷ garment length. */
  shoulderToLength?: number;
};

function shapeSentence(p: GhostProportions): string | null {
  const parts: string[] = [];
  if (p.chestToLength) {
    parts.push(
      `its width across the chest is ${(p.chestToLength * 100).toFixed(0)}% of its shoulder-to-hem length`,
    );
  }
  if (p.hemToLength && p.chestToLength) {
    const ratio = p.hemToLength / p.chestToLength;
    const shape =
      ratio > 1.12
        ? "flaring wider toward the hem"
        : ratio < 0.92
          ? "tapering narrower toward the hem"
          : "falling straight from chest to hem with no flare";
    parts.push(shape);
  }
  if (p.shoulderToLength && p.chestToLength) {
    const ratio = p.shoulderToLength / p.chestToLength;
    if (ratio < 0.72) parts.push("with narrow shoulders relative to the body");
    else if (ratio > 0.95) parts.push("with wide, extended shoulders");
  }
  if (parts.length === 0) return null;
  return `Hold these exact proportions from the input: ${parts.join(", ")}.`;
}

export function ghostMannequinPrompt(spec: {
  garmentType: GarmentType;
  lengthBand: LengthBand;
  points?: StylePoints;
  /** Measured from the uploaded photo, when landmark detection succeeded. */
  proportions?: GhostProportions;
}): string {
  const sleeve = SLEEVE[spec.points?.sleeve?.style ?? defaultSleeve(spec.garmentType)];
  const neck = NECK[spec.points?.neck?.shape ?? "round"];
  const shape = spec.proportions ? shapeSentence(spec.proportions) : null;
  return [
    `Reproduce the EXACT garment in the provided photo as a professional`,
    `e-commerce ghost-mannequin (invisible mannequin) product shot. Do not`,
    `redesign, restyle, or embellish it: same cut, same colour, same fabric,`,
    `same trims, same embroidery placement, same proportions as the input.`,
    ``,
    `The garment is a ${GARMENT[spec.garmentType]} with ${sleeve} sleeves, a`,
    `${neck} neckline, and a ${HEM[spec.lengthBand]} hem. It is worn on an unseen`,
    `form so it holds a natural, filled 3D shape with realistic drape and soft`,
    `fabric folds. No mannequin, stand, body, hands, head, or feet visible —`,
    `garment only.`,
    ...(shape ? ["", shape] : []),
    ``,
    `Framing is critical: front view, perfectly straight-on, symmetrical, and`,
    `flat to the camera with no perspective tilt or foreshortening. The whole`,
    `garment is centered with even margins, shoulder seams and hem fully`,
    `visible, nothing cropped. Sleeves fall naturally at the sides without`,
    `covering the side seams.`,
    ``,
    `Seamless bone-white studio backdrop. Soft, even, diffused lighting with no`,
    `harsh shadows. Colour-accurate to the input, true fabric texture preserved.`,
  ].join("\n");
}
