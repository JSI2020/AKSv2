import { and, asc, eq, inArray } from "drizzle-orm";

import {
  colourways,
  db,
  designs,
  fabrics,
  fitProfiles,
  garmentCategories,
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
  type OrderMeasurementSnapshot,
  type OrderCutSpecSnapshot,
} from "@aks/db";

import { calculateCutSpec, resolveChart } from "@/modules/sizing/engine";

import type { DbTx } from "@/modules/platform/types";

function normalizeBodyKeys(
  values: Record<string, number>,
  components: readonly string[],
): Record<string, number> {
  if (components.length <= 1) {
    const body: Record<string, number> = {};
    for (const [key, value] of Object.entries(values)) {
      const bare = key.includes(":") ? (key.split(":")[1] ?? key) : key;
      body[bare] = value;
    }
    return body;
  }
  return values;
}

async function loadMergedFitEase(
  fitProfileIds: Record<string, string>,
  tx: DbTx = db,
): Promise<Record<string, number>> {
  const ids = [...new Set(Object.values(fitProfileIds))];
  if (ids.length === 0) return {};

  const rows = await tx
    .select({ easeByMeasurement: fitProfiles.easeByMeasurement })
    .from(fitProfiles)
    .where(and(inArray(fitProfiles.id, ids), eq(fitProfiles.active, true)));

  const merged: Record<string, number> = {};
  for (const row of rows) {
    Object.assign(merged, row.easeByMeasurement ?? {});
  }
  return merged;
}

async function resolveStandardBody(
  sizeBlockId: string,
  sizeLabel: string,
  tx: DbTx = db,
): Promise<Record<string, number>> {
  const [block] = await tx
    .select({
      id: sizeBlocks.id,
      sizeLabels: sizeBlocks.sizeLabels,
      baseSizeLabel: sizeBlocks.baseSizeLabel,
    })
    .from(sizeBlocks)
    .where(and(eq(sizeBlocks.id, sizeBlockId), eq(sizeBlocks.active, true)))
    .limit(1);

  if (!block || !block.sizeLabels.includes(sizeLabel)) {
    return {};
  }

  const [rows, pinned] = await Promise.all([
    tx
      .select({
        measurementKey: sizeBlockRows.measurementKey,
        baseValue: sizeBlockRows.baseValue,
        gradeIncrement: sizeBlockRows.gradeIncrement,
        gradeOverrides: sizeBlockRows.gradeOverrides,
      })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, block.id))
      .orderBy(asc(sizeBlockRows.sortOrder)),
    tx
      .select({
        measurementKey: sizeBlockCells.measurementKey,
        sizeLabel: sizeBlockCells.sizeLabel,
        value: sizeBlockCells.value,
      })
      .from(sizeBlockCells)
      .where(
        and(
          eq(sizeBlockCells.blockId, block.id),
          eq(sizeBlockCells.isPinned, true),
        ),
      ),
  ]);

  if (rows.length === 0) return {};

  const grid = resolveChart(
    {
      sizeLabels: block.sizeLabels,
      baseSizeLabel: block.baseSizeLabel,
    },
    rows.map((row) => ({
      measurementKey: row.measurementKey,
      baseValue: row.baseValue,
      gradeIncrement: row.gradeIncrement,
      gradeOverrides: row.gradeOverrides ?? {},
    })),
    pinned.map((cell) => ({
      measurementKey: cell.measurementKey,
      sizeLabel: cell.sizeLabel,
      value: cell.value,
    })),
  );

  const body: Record<string, number> = {};
  for (const row of rows) {
    const value = grid[row.measurementKey]?.[sizeLabel]?.value;
    if (value !== undefined) {
      body[row.measurementKey] = value;
    }
  }
  return body;
}

/** Frozen chart values for a standard size — never an FK. */
export async function buildStandardMeasurementSnapshot(
  input: { designId: string; sizeLabel: string },
  tx: DbTx = db,
): Promise<Extract<OrderMeasurementSnapshot, object>> {
  const [design] = await tx
    .select({ sizeBlockId: designs.sizeBlockId })
    .from(designs)
    .where(eq(designs.id, input.designId))
    .limit(1);

  if (!design?.sizeBlockId) {
    throw new Error("Design has no size block for standard sizing.");
  }

  const values = await resolveStandardBody(
    design.sizeBlockId,
    input.sizeLabel,
    tx,
  );
  if (Object.keys(values).length === 0) {
    throw new Error(`No chart values for size ${input.sizeLabel}.`);
  }

  return {
    sessionId: `standard:${input.sizeLabel}`,
    values,
  };
}

export async function computeCutSpecSnapshot(
  input: {
    designId: string;
    colourwayId: string;
    sizeMode: "STANDARD" | "MADE_TO_MEASURE";
    sizeLabel: string | null;
    measurementSnapshot: OrderMeasurementSnapshot;
  },
  tx: DbTx = db,
): Promise<OrderCutSpecSnapshot> {
  const [design] = await tx
    .select({
      sizeBlockId: designs.sizeBlockId,
      fitProfileIds: designs.fitProfileIds,
      components: designs.components,
      garmentTypeId: designs.garmentTypeId,
    })
    .from(designs)
    .where(eq(designs.id, input.designId))
    .limit(1);

  if (!design) return null;

  const [colourway] = await tx
    .select({ fabricId: colourways.fabricId })
    .from(colourways)
    .where(eq(colourways.id, input.colourwayId))
    .limit(1);

  if (!colourway) return null;

  const [fabric] = await tx
    .select({
      stretchPercent: fabrics.stretchPercent,
      shrinkageAllowance: fabrics.shrinkageAllowance,
    })
    .from(fabrics)
    .where(eq(fabrics.id, colourway.fabricId))
    .limit(1);

  if (!fabric) return null;

  const easeByMeasurement = await loadMergedFitEase(
    design.fitProfileIds ?? {},
    tx,
  );

  let rawBody: Record<string, number>;
  if (input.sizeMode === "MADE_TO_MEASURE") {
    if (!input.measurementSnapshot?.values) return null;
    rawBody = input.measurementSnapshot.values;
  } else if (input.measurementSnapshot?.values) {
    rawBody = input.measurementSnapshot.values;
  } else {
    if (!design.sizeBlockId || !input.sizeLabel) return null;
    rawBody = await resolveStandardBody(
      design.sizeBlockId,
      input.sizeLabel,
      tx,
    );
  }

  if (Object.keys(rawBody).length === 0) return null;

  const [category] = await tx
    .select({ key: garmentCategories.key })
    .from(garmentCategories)
    .where(eq(garmentCategories.id, design.garmentTypeId))
    .limit(1);

  const components =
    design.components.length > 0
      ? design.components
      : category?.key
        ? [category.key]
        : [];

  const body = normalizeBodyKeys(rawBody, components);

  return calculateCutSpec({
    body,
    fitProfile: { easeByMeasurement },
    fabric: {
      stretchPercent: fabric.stretchPercent,
      shrinkageAllowance: fabric.shrinkageAllowance,
    },
  });
}
