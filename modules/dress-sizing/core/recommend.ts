import { DEFAULT_BASE_SIZE, STANDARD_SIZES } from "../db/enums";
import type { FitWeightDimension, StandardSize } from "../db/enums";
import { inchesToHundredths } from "./units";
import type { BodyGrid, FitWeight, ShopperBody } from "./types";

export type FitNote = "tight" | "ok" | "loose";
export type SizeRecommendation = {
  size: StandardSize;
  cost: number;
  notes: Partial<Record<FitWeightDimension, FitNote>>;
  costs: Record<StandardSize, number>;
};
const TIGHT_THRESHOLD_HUNDREDTHS = inchesToHundredths(0.5);
const penalty = (difference: number) => difference > 0 ? difference * 2 : Math.abs(difference);
function noteFor(difference: number): FitNote {
  if (difference > TIGHT_THRESHOLD_HUNDREDTHS) return "tight";
  if (difference < -TIGHT_THRESHOLD_HUNDREDTHS) return "loose";
  return "ok";
}
export function recommendSize(body: ShopperBody, grid: BodyGrid, weights: FitWeight[]): SizeRecommendation {
  const costs = {} as Record<StandardSize, number>;
  let bestSize: StandardSize = DEFAULT_BASE_SIZE;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const size of STANDARD_SIZES) {
    const target = grid[size];
    let cost = 0;
    for (const { dimension, weight } of weights) {
      if (weight === 0) continue;
      const bodyValue = dimension === "height" ? (body.height ?? target.height) : body[dimension];
      cost += weight * penalty(bodyValue - target[dimension]);
    }
    costs[size] = cost;
    if (cost < bestCost) { bestCost = cost; bestSize = size; }
  }
  const chosen = grid[bestSize];
  const notes: Partial<Record<FitWeightDimension, FitNote>> = {};
  for (const { dimension, weight } of weights) {
    if (weight === 0) continue;
    const bodyValue = dimension === "height" ? (body.height ?? chosen.height) : body[dimension];
    notes[dimension] = noteFor(bodyValue - chosen[dimension]);
  }
  return { size: bestSize, cost: bestCost, notes, costs };
}
