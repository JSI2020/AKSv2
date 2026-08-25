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
export function ghostMannequinPrompt(spec: {
  garmentType: GarmentType;
  lengthBand: LengthBand;
  points?: StylePoints;
}): string {
  const sleeve = SLEEVE[spec.points?.sleeve?.style ?? defaultSleeve(spec.garmentType)];
  const neck = NECK[spec.points?.neck?.shape ?? "round"];
  return [
    `Present the provided garment as a professional e-commerce ghost-mannequin`,
    `(invisible mannequin) product shot. The garment — a ${GARMENT[spec.garmentType]} in`,
    `the same colour as the input, with ${sleeve} sleeves, ${neck} neckline, and`,
    `${HEM[spec.lengthBand]} hem — is worn on an unseen form so it holds a natural,`,
    `filled 3D shape with realistic drape and soft fabric folds. No mannequin,`,
    `stand, body, hands, head, or feet visible — garment only.`,
    ``, `Front view, perfectly straight-on and symmetrical. Full garment centered`,
    `in frame with even margin on all sides, hem fully visible, nothing cropped.`,
    `Seamless bone-white studio backdrop. Soft, even, diffused lighting.`,
    `Colour-accurate to the input, true fabric texture preserved.`,
  ].join("\n");
}
