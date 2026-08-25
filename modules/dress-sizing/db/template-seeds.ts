import { inchesToHundredths } from "../core/units";
import type { TemplateInput } from "../core/instantiate";
import type { FitWeight, StylePomSpec } from "../core/types";
import type { GarmentType, StyleCategory } from "./enums";

function girth(key: StylePomSpec["key"], derivedFrom: NonNullable<StylePomSpec["derivedFrom"]>, ease: number): StylePomSpec {
  return { key, kind: "girth", derivedFrom, ease: inchesToHundredths(ease), baseValue: null, gradeIncrement: 0 };
}
function design(key: StylePomSpec["key"], base: number, grade: number): StylePomSpec {
  return { key, kind: "design", derivedFrom: null, ease: null, baseValue: inchesToHundredths(base), gradeIncrement: inchesToHundredths(grade) };
}
function weights(bust: number, waist: number, hip: number, height: number): FitWeight[] {
  return [
    { dimension: "bust", weight: bust }, { dimension: "waist", weight: waist },
    { dimension: "hip", weight: hip }, { dimension: "height", weight: height },
  ];
}
const shared = (sleeve: number, hem: number, neck: number) => [
  design("sleeveLength", sleeve, 0.25),
  design("hemWidth", hem, 0.75),
  design("neckDrop", neck, 0.125),
];
export const STYLE_TEMPLATE_SEEDS: Array<TemplateInput & { key: GarmentType; category: StyleCategory }> = [
  { key: "short_shirt", category: "essentials", poms: [girth("chest", "bust", 3), girth("waist", "waist", 4), girth("hip", "hip", 3), girth("shoulder", "shoulder", 0.5), design("garmentLength", 31, 1), ...shared(22, 22, 3)], fitWeights: weights(3, 2, 1, 1) },
  { key: "long_gown", category: "occasion", poms: [girth("chest", "bust", 2), girth("waist", "waist", 3), girth("shoulder", "shoulder", 0.5), design("garmentLength", 51, 1), ...shared(20.5, 28, 4)], fitWeights: weights(3, 2, 2, 2) },
  { key: "kurti", category: "modern_tailored", poms: [girth("chest", "bust", 3), girth("waist", "waist", 4), girth("hip", "hip", 3), girth("shoulder", "shoulder", 0.5), design("garmentLength", 38, 1), ...shared(22, 24, 3)], fitWeights: weights(3, 2, 2, 1) },
  { key: "vest_palazzo", category: "signature", poms: [girth("chest", "bust", 3), girth("waist", "waist", 4), girth("hip", "hip", 12), girth("shoulder", "shoulder", 0.5), design("garmentLength", 42, 1), ...shared(0, 30, 3)], fitWeights: weights(2, 2, 3, 1) },
  { key: "trouser", category: "separates", poms: [girth("chest", "bust", 0), girth("waist", "waist", 1), girth("hip", "hip", 12), girth("shoulder", "shoulder", 0), design("garmentLength", 42, 0.5), ...shared(0, 16, 0)], fitWeights: weights(0, 3, 3, 1) },
];
