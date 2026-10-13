/**

 * Shared publish readiness — same rules as admin `publishDesign`.

 * Used by the admin action and by catalogue seeding so storefront

 * only ever receives designs that could have been published in admin.

 */



import { parseShadeCostingSnapshot } from "@/modules/money/shade-costing";



export type PublishChecklistDesign = {

  basePriceMinor: number;

  fabricConsumptionMeters: number;

  sizeBlockId: string | null;

  fitProfileIds: Record<string, string> | null;

  components?: string[];

};



export type PublishChecklistColourway = {

  id: string;

  name: string;

  basePriceMinor?: number | null;

  costingSnapshot?: Record<string, unknown> | null;

};



export type PublishChecklistRender = {

  colourwayId: string;

  angle: string;

  altText: string;

  /** Real uploads count as a photo. AI visualisations do not. */

  isAiGenerated?: boolean;

};



export type PublishChecklistTag = {

  kind: string;

  value: string;

};



/** Retail price for publish — design row or any priced shade. */

export function resolveEffectiveBasePriceMinor(

  design: Pick<PublishChecklistDesign, "basePriceMinor">,

  colourways: Pick<PublishChecklistColourway, "basePriceMinor">[],

): number {

  if (design.basePriceMinor > 0) return design.basePriceMinor;

  for (const cw of colourways) {

    if (cw.basePriceMinor != null && cw.basePriceMinor > 0) {

      return cw.basePriceMinor;

    }

  }

  return 0;

}



function shadeHasFabricConsumption(

  snapshot: Record<string, unknown> | null | undefined,

): boolean {

  const parsed = parseShadeCostingSnapshot(snapshot);

  if (!parsed) return false;

  if (parsed.fabricMeters > 0) return true;

  if (

    parsed.costingMode === "TOTAL_LUMPSUM" &&

    (parsed.totalLumpsumMinor ?? 0) > 0

  ) {

    return true;

  }

  return parsed.pieceCosts.some((piece) => {

    if (piece.mode === "LUMPSUM") return (piece.lumpsumMinor ?? 0) > 0;

    return (piece.fabricMeters ?? 0) > 0;

  });

}



/** Fabric metres (design row) or saved shade costing. */

export function resolveEffectiveFabricMeters(

  design: Pick<PublishChecklistDesign, "fabricConsumptionMeters">,

  colourways: Pick<PublishChecklistColourway, "costingSnapshot">[],

): number {

  if (design.fabricConsumptionMeters > 0) return design.fabricConsumptionMeters;

  for (const cw of colourways) {

    const parsed = parseShadeCostingSnapshot(cw.costingSnapshot);

    if (parsed && parsed.fabricMeters > 0) return parsed.fabricMeters;

  }

  return 0;

}



export function hasEffectiveFabricConsumption(

  design: Pick<PublishChecklistDesign, "fabricConsumptionMeters">,

  colourways: Pick<PublishChecklistColourway, "costingSnapshot">[],

): boolean {

  if (design.fabricConsumptionMeters > 0) return true;

  return colourways.some((cw) => shadeHasFabricConsumption(cw.costingSnapshot));

}



const GARMENT_ANGLES = new Set(["FRONT", "THREE_QUARTER", "BACK", "DETAIL"]);



/** A stored garment image that is not an AI visualisation. */

export function isPublishPhoto(render: PublishChecklistRender): boolean {

  if (render.isAiGenerated === true) return false;

  return GARMENT_ANGLES.has(render.angle);

}



/**

 * Cost in paisa. Design-level total wins when it is set; otherwise the

 * highest saved shade snapshot.

 */

export function resolveEffectiveCostMinor(

  colourways: Pick<PublishChecklistColourway, "costingSnapshot">[],

  designCostMinor?: number | null,

): number {

  if (designCostMinor != null && designCostMinor > 0) return designCostMinor;

  let best = 0;

  for (const cw of colourways) {

    const parsed = parseShadeCostingSnapshot(cw.costingSnapshot);

    const cost = parsed?.totalCostMinor ?? 0;

    if (cost > best) best = cost;

  }

  return best;

}



/** Warning only — cost at or above price does not block publish. */

export function publishMarginWarning(

  costMinor: number,

  priceMinor: number,

): string | null {

  if (costMinor <= 0 || priceMinor <= 0) return null;

  if (costMinor >= priceMinor) {

    return "Cost is at or above the selling price. The margin is zero or negative.";

  }

  return null;

}



export function evaluatePublishChecklist(input: {

  design: PublishChecklistDesign;

  colourways: PublishChecklistColourway[];

  renders: PublishChecklistRender[];

  tags: PublishChecklistTag[];

  /** Design-level `design_costs.total_cost_minor`, when a row exists. */

  designCostMinor?: number | null;

  /** When provided, blocks publish if the size chart pointer exists but has no rows. */

  sizeBlockRowCount?: number | null;

}): string[] {

  const missing: string[] = [];

  const components = input.design.components ?? [];



  if (components.length < 1) {

    missing.push("≥1 article type");

  }

  if (input.colourways.length < 1) missing.push("≥1 colourway");

  for (const cw of input.colourways) {

    const cwRenders = input.renders.filter((r) => r.colourwayId === cw.id);

    if (cwRenders.length < 1) missing.push(`render for ${cw.name}`);

    for (const r of cwRenders) {

      if (!r.altText.trim()) missing.push(`alt text on ${cw.name}/${r.angle}`);

    }

  }

  if (!input.renders.some(isPublishPhoto)) {

    missing.push("a photo");

  }

  if (resolveEffectiveBasePriceMinor(input.design, input.colourways) <= 0) {

    missing.push("base price");

  }

  if (resolveEffectiveCostMinor(input.colourways, input.designCostMinor) <= 0) {

    missing.push("cost");

  }

  if (!hasEffectiveFabricConsumption(input.design, input.colourways)) {

    missing.push("fabric consumption");

  }

  if (!input.design.sizeBlockId) missing.push("size block");

  if (

    input.design.sizeBlockId &&

    input.sizeBlockRowCount != null &&

    input.sizeBlockRowCount < 1

  ) {

    missing.push(

      "the size chart has no measurement rows — add sizing before publishing",

    );

  }

  // Fit profiles are made-to-measure ease; the house sells standard sizes to
  // a finished-garment chart, so a fit profile is not required to publish.

  if (!input.tags.some((t) => t.kind === "OCCASION")) {

    missing.push("occasion tag");

  }

  return missing;

}


