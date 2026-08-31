/**
 * Shared publish readiness — same rules as admin `publishDesign`.
 * Used by the admin action and by catalogue seeding so storefront
 * only ever receives designs that could have been published in admin.
 */

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

export function evaluatePublishChecklist(input: {
  design: PublishChecklistDesign;
  colourways: PublishChecklistColourway[];
  renders: PublishChecklistRender[];
  tags: PublishChecklistTag[];
  /** When provided, blocks publish if the size chart pointer exists but has no rows. */
  sizeBlockRowCount?: number | null;
}): string[] {
  const missing: string[] = [];
  if ((input.design.components?.length ?? 0) < 1) {
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
  if (input.design.basePriceMinor <= 0) missing.push("base price");
  if (input.design.fabricConsumptionMeters <= 0) {
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
  if (Object.keys(input.design.fitProfileIds ?? {}).length < 1) {
    missing.push("fit profile");
  }
  return missing;
}
