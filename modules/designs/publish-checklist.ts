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

function hasFitProfilesForComponents(
  components: string[],
  fitProfileIds: Record<string, string> | null | undefined,
): boolean {
  if (components.length < 1) return false;
  const map = fitProfileIds ?? {};
  return components.every((key) => Boolean(map[key]));
}

export function evaluatePublishChecklist(input: {
  design: PublishChecklistDesign;
  colourways: PublishChecklistColourway[];
  renders: PublishChecklistRender[];
  tags: PublishChecklistTag[];
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
  if (resolveEffectiveBasePriceMinor(input.design, input.colourways) <= 0) {
    missing.push("base price");
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
  if (!hasFitProfilesForComponents(components, input.design.fitProfileIds)) {
    missing.push("fit profile");
  }
  if (!input.tags.some((t) => t.kind === "OCCASION")) {
    missing.push("occasion tag");
  }
  return missing;
}
