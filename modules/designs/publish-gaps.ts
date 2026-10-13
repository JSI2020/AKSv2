import "server-only";

import { eq, inArray } from "drizzle-orm";

import {
  colourways,
  db,
  designCosts,
  designRenders,
  designs,
} from "@aks/db";

import { requirePermission } from "@/modules/auth";

import {
  isPublishPhoto,
  resolveEffectiveBasePriceMinor,
  resolveEffectiveCostMinor,
  type PublishChecklistRender,
} from "./publish-checklist";

export type PublishedCatalogueGap = {
  id: string;
  name: string;
  slug: string;
  missingPhoto: boolean;
  zeroCost: boolean;
  priceMinor: number;
  costMinor: number;
};

export async function getDesignStoredCostMinor(
  designId: string,
): Promise<number | null> {
  const [row] = await db
    .select({ totalCostMinor: designCosts.totalCostMinor })
    .from(designCosts)
    .where(eq(designCosts.designId, designId))
    .limit(1);
  return row?.totalCostMinor ?? null;
}

/**
 * Published designs that would fail the photo or cost gate.
 * Read-only — nothing here changes status.
 */
export async function listPublishedCatalogueGaps(): Promise<
  PublishedCatalogueGap[]
> {
  await requirePermission("designs.view");

  const published = await db
    .select({
      id: designs.id,
      name: designs.name,
      slug: designs.slug,
      basePriceMinor: designs.basePriceMinor,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"));

  if (published.length === 0) return [];

  const ids = published.map((d) => d.id);
  const [renderRows, shadeRows, costRows] = await Promise.all([
    db
      .select({
        designId: designRenders.designId,
        colourwayId: designRenders.colourwayId,
        angle: designRenders.angle,
        altText: designRenders.altText,
        isAiGenerated: designRenders.isAiGenerated,
      })
      .from(designRenders)
      .where(inArray(designRenders.designId, ids)),
    db
      .select({
        designId: colourways.designId,
        basePriceMinor: colourways.basePriceMinor,
        costingSnapshot: colourways.costingSnapshot,
      })
      .from(colourways)
      .where(inArray(colourways.designId, ids)),
    db
      .select({
        designId: designCosts.designId,
        totalCostMinor: designCosts.totalCostMinor,
      })
      .from(designCosts)
      .where(inArray(designCosts.designId, ids)),
  ]);

  const rendersByDesign = new Map<string, PublishChecklistRender[]>();
  for (const row of renderRows) {
    const list = rendersByDesign.get(row.designId) ?? [];
    list.push(row);
    rendersByDesign.set(row.designId, list);
  }
  const shadesByDesign = new Map<string, typeof shadeRows>();
  for (const row of shadeRows) {
    const list = shadesByDesign.get(row.designId) ?? [];
    list.push(row);
    shadesByDesign.set(row.designId, list);
  }
  const costByDesign = new Map(
    costRows.map((row) => [row.designId, row.totalCostMinor]),
  );

  const gaps: PublishedCatalogueGap[] = [];
  for (const design of published) {
    const shades = shadesByDesign.get(design.id) ?? [];
    const photos = rendersByDesign.get(design.id) ?? [];
    const costMinor = resolveEffectiveCostMinor(
      shades,
      costByDesign.get(design.id) ?? null,
    );
    const missingPhoto = !photos.some(isPublishPhoto);
    const zeroCost = costMinor <= 0;
    if (!missingPhoto && !zeroCost) continue;
    gaps.push({
      id: design.id,
      name: design.name,
      slug: design.slug,
      missingPhoto,
      zeroCost,
      priceMinor: resolveEffectiveBasePriceMinor(design, shades),
      costMinor,
    });
  }

  return gaps.sort((a, b) => a.name.localeCompare(b.name));
}
