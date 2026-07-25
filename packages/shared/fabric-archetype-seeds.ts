import { inches } from "./size-block-seeds";

export type FabricSeed = {
  name: string;
  composition: string;
  weightGsm: number;
  widthInches: number;
  stretchPercent: number;
  shrinkageAllowance: number;
  drapeClass: "LIGHT" | "MEDIUM" | "HEAVY";
  costPerMeterMinor: number;
  careInstructions: string;
  drapeNotes: string;
};

export const FABRIC_SEEDS: readonly FabricSeed[] = [
  {
    name: "Lawn",
    composition: "Cotton lawn",
    weightGsm: 70,
    widthInches: inches(44),
    stretchPercent: 0,
    shrinkageAllowance: inches(0.5),
    drapeClass: "LIGHT",
    costPerMeterMinor: 85000,
    careInstructions: "Cold wash; expect mild shrinkage.",
    drapeNotes: "Crisp, breathable — summer staple.",
  },
  {
    name: "Chiffon",
    composition: "Polyester chiffon",
    weightGsm: 40,
    widthInches: inches(44),
    stretchPercent: 0,
    shrinkageAllowance: inches(0),
    drapeClass: "LIGHT",
    costPerMeterMinor: 120000,
    careInstructions: "Dry clean or gentle hand wash.",
    drapeNotes: "Floaty, sheer.",
  },
  {
    name: "Silk",
    composition: "Silk",
    weightGsm: 80,
    widthInches: inches(44),
    stretchPercent: 0,
    shrinkageAllowance: inches(0.25),
    drapeClass: "MEDIUM",
    costPerMeterMinor: 450000,
    careInstructions: "Dry clean.",
    drapeNotes: "Fluid lustre.",
  },
  {
    name: "Organza",
    composition: "Silk organza",
    weightGsm: 35,
    widthInches: inches(44),
    stretchPercent: 0,
    shrinkageAllowance: inches(0),
    drapeClass: "LIGHT",
    costPerMeterMinor: 280000,
    careInstructions: "Dry clean.",
    drapeNotes: "Crisp sheer structure.",
  },
  {
    name: "Cotton",
    composition: "Cotton",
    weightGsm: 140,
    widthInches: inches(44),
    stretchPercent: 0,
    shrinkageAllowance: inches(0.75),
    drapeClass: "MEDIUM",
    costPerMeterMinor: 65000,
    careInstructions: "Cold wash; pre-shrink before cut.",
    drapeNotes: "Everyday body — meaningful shrinkage.",
  },
  {
    name: "Khaddar",
    composition: "Handloom cotton",
    weightGsm: 180,
    widthInches: inches(36),
    stretchPercent: 0,
    shrinkageAllowance: inches(0.5),
    drapeClass: "HEAVY",
    costPerMeterMinor: 95000,
    careInstructions: "Cold wash.",
    drapeNotes: "Textured winter weave.",
  },
  {
    name: "Velvet",
    composition: "Silk-blend velvet",
    weightGsm: 250,
    widthInches: inches(44),
    stretchPercent: 5,
    shrinkageAllowance: inches(0.25),
    drapeClass: "HEAVY",
    costPerMeterMinor: 520000,
    careInstructions: "Dry clean.",
    drapeNotes: "Pile direction matters.",
  },
  {
    name: "Net",
    composition: "Nylon net",
    weightGsm: 30,
    widthInches: inches(60),
    stretchPercent: 10,
    shrinkageAllowance: inches(0),
    drapeClass: "LIGHT",
    costPerMeterMinor: 75000,
    careInstructions: "Gentle wash.",
    drapeNotes: "Stretchy sheer overlay.",
  },
  {
    name: "Jamawar",
    composition: "Wool-silk jamawar",
    weightGsm: 200,
    widthInches: inches(36),
    stretchPercent: 0,
    shrinkageAllowance: inches(0.25),
    drapeClass: "HEAVY",
    costPerMeterMinor: 680000,
    careInstructions: "Dry clean.",
    drapeNotes: "Brocade weight.",
  },
  {
    name: "Linen",
    composition: "Linen",
    weightGsm: 160,
    widthInches: inches(54),
    stretchPercent: 0,
    shrinkageAllowance: inches(0.5),
    drapeClass: "MEDIUM",
    costPerMeterMinor: 180000,
    careInstructions: "Cold wash; softens with wear.",
    drapeNotes: "Breathable, wrinkles honestly.",
  },
];

export type HouseModelSeed = {
  name: string;
  isDefault?: boolean;
  heightCm: number;
  heightInches: number;
  bust: number;
  waist: number;
  hip: number;
  shoulder: number;
  wearsSizeLabel: string;
  buildDescription: string;
  identitySeed: string;
};

export const HOUSE_MODEL_SEEDS: readonly HouseModelSeed[] = [
  {
    name: "Regular",
    isDefault: true,
    heightCm: 170,
    heightInches: inches(67),
    bust: inches(36),
    waist: inches(28),
    hip: inches(38),
    shoulder: inches(14.5),
    wearsSizeLabel: "M",
    buildDescription: "Balanced house default.",
    identitySeed: "aks-archetype-regular-v1",
  },
  {
    name: "Petite",
    heightCm: 157,
    heightInches: inches(62),
    bust: inches(34),
    waist: inches(26),
    hip: inches(36),
    shoulder: inches(13.5),
    wearsSizeLabel: "S",
    buildDescription: "Shorter stature, proportionally scaled.",
    identitySeed: "aks-archetype-petite-v1",
  },
  {
    name: "Curvy",
    heightCm: 168,
    heightInches: inches(66),
    bust: inches(40),
    waist: inches(32),
    hip: inches(44),
    shoulder: inches(15),
    wearsSizeLabel: "L",
    buildDescription: "Fuller hip and bust.",
    identitySeed: "aks-archetype-curvy-v1",
  },
  {
    name: "Tall",
    heightCm: 178,
    heightInches: inches(70),
    bust: inches(36),
    waist: inches(28),
    hip: inches(38),
    shoulder: inches(15),
    wearsSizeLabel: "M",
    buildDescription: "Longer torso and limb length.",
    identitySeed: "aks-archetype-tall-v1",
  },
];

/**
 * Customer-facing model disclosure from authored measurements.
 * Example: Model is 5'7″ (170 cm) and wears size M. Bust 36″ · Waist 28″ · Hip 38″
 */
export function formatModelDisclosure(model: {
  heightInches: number;
  heightCm: number;
  wearsSizeLabel: string;
  bust: number;
  waist: number;
  hip: number;
}): string {
  const totalIn = model.heightInches / 100;
  const feet = Math.floor(totalIn / 12);
  const inchPart = totalIn - feet * 12;
  const inchStr =
    inchPart % 1 === 0
      ? `${inchPart}`
      : inchPart.toFixed(1).replace(/\.0$/, "");
  const fmt = (hundredths: number) => {
    const n = hundredths / 100;
    return n % 1 === 0 ? `${n}` : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  };
  return `Model is ${feet}'${inchStr}″ (${model.heightCm} cm) and wears size ${model.wearsSizeLabel}. Bust ${fmt(model.bust)}″ · Waist ${fmt(model.waist)}″ · Hip ${fmt(model.hip)}″`;
}
