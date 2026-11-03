import { asc, eq, inArray } from "drizzle-orm";

import {
  db,
  garmentCategories,
  sizeBlockRows,
  sizeBlocks,
} from "@aks/db";
import {
  MEASUREMENT_KEY_DEFS,
  STANDARD_SIZE_LABELS,
} from "@aks/shared";
import { resolveChart } from "@/modules/sizing/engine/resolve-chart";
import type {
  SizeBlockInput,
  SizeBlockRowInput,
} from "@/modules/sizing/engine/types";

const labelByKey = new Map(
  MEASUREMENT_KEY_DEFS.map((d) => [d.key, d.label] as const),
);

export type SizeGuideChartPublic = {
  blockId: string;
  blockName: string;
  categoryKey: string;
  categoryName: string;
  sizeLabels: string[];
  baseSizeLabel: string;
  rows: {
    measurementKey: string;
    label: string;
    values: Record<string, number>;
  }[];
};

/**
 * Active house size blocks for the storefront size guide.
 * Prefer default blocks; if none are marked default, fall back to any active
 * block that has measurement rows so the page is never empty after seed.
 * Values are hundredths of an inch — render with <Measure>.
 */
export async function listSizeGuideCharts(): Promise<SizeGuideChartPublic[]> {
  const blocks = await db
    .select({
      id: sizeBlocks.id,
      name: sizeBlocks.name,
      sizeLabels: sizeBlocks.sizeLabels,
      baseSizeLabel: sizeBlocks.baseSizeLabel,
      isDefault: sizeBlocks.isDefault,
      categoryKey: garmentCategories.key,
      categoryName: garmentCategories.name,
    })
    .from(sizeBlocks)
    .innerJoin(
      garmentCategories,
      eq(sizeBlocks.categoryId, garmentCategories.id),
    )
    .where(eq(sizeBlocks.active, true))
    .orderBy(asc(garmentCategories.name), asc(sizeBlocks.name));

  if (blocks.length === 0) return [];

  const defaults = blocks.filter((b) => b.isDefault);
  const preferred = defaults.length > 0 ? defaults : blocks;
  const blockIds = preferred.map((b) => b.id);
  const allRows = await db
    .select({
      blockId: sizeBlockRows.blockId,
      measurementKey: sizeBlockRows.measurementKey,
      baseValue: sizeBlockRows.baseValue,
      gradeIncrement: sizeBlockRows.gradeIncrement,
      gradeOverrides: sizeBlockRows.gradeOverrides,
      sortOrder: sizeBlockRows.sortOrder,
    })
    .from(sizeBlockRows)
    .where(inArray(sizeBlockRows.blockId, blockIds))
    .orderBy(asc(sizeBlockRows.sortOrder));

  const rowsByBlock = new Map<string, typeof allRows>();
  for (const row of allRows) {
    const list = rowsByBlock.get(row.blockId) ?? [];
    list.push(row);
    rowsByBlock.set(row.blockId, list);
  }

  const charts: SizeGuideChartPublic[] = [];

  for (const block of preferred) {
    const rows = rowsByBlock.get(block.id) ?? [];
    if (rows.length === 0) continue;

    const labels =
      block.sizeLabels.length > 0
        ? [...block.sizeLabels]
        : [...STANDARD_SIZE_LABELS];

    const blockInput: SizeBlockInput = {
      sizeLabels: labels,
      baseSizeLabel: block.baseSizeLabel || "M",
    };
    const rowInputs: SizeBlockRowInput[] = rows.map((r) => ({
      measurementKey: r.measurementKey,
      baseValue: r.baseValue,
      gradeIncrement: r.gradeIncrement,
      gradeOverrides: (r.gradeOverrides as Record<string, number>) ?? {},
    }));

    const grid = resolveChart(blockInput, rowInputs, []);

    charts.push({
      blockId: block.id,
      blockName: block.name,
      categoryKey: block.categoryKey,
      categoryName: block.categoryName,
      sizeLabels: labels,
      baseSizeLabel: blockInput.baseSizeLabel,
      rows: rows.map((r) => {
        const values: Record<string, number> = {};
        for (const label of labels) {
          values[label] =
            grid[r.measurementKey]?.[label]?.value ?? r.baseValue;
        }
        return {
          measurementKey: r.measurementKey,
          label: labelByKey.get(r.measurementKey) ?? r.measurementKey,
          values,
        };
      }),
    });
  }

  // Prefer house wearable charts (XS–XXL). Drop one-size fabric/accessory
  // placeholders when real size charts are present.
  const wearable = charts.filter(
    (c) =>
      c.sizeLabels.length > 1 &&
      !c.sizeLabels.every((l) => /one\s*size/i.test(l)),
  );
  return wearable.length > 0 ? wearable : charts;
}
