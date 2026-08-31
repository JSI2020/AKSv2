import { and, asc, eq } from "drizzle-orm";

import {
  db,
  garmentCategories,
  sizeBlockCells,
  sizeBlockRows,
  sizeBlocks,
} from "@aks/db";
import {
  GARMENT_CATEGORY_SEEDS,
  MEASUREMENT_KEY_DEFS,
  type MeasurementKeyCode,
} from "@aks/shared";
import type { SilhouetteMode } from "@/modules/dress-sizing/core/silhouette";

import { resolveChart } from "@/modules/sizing/engine";
import type { GarmentChartRow } from "@/modules/sizing/garment-size-guide/types";
import { displayGarmentChartRows } from "@/modules/sizing/garment-size-guide";

import {
  filterStorefrontChartRows,
  toGarmentChartRows,
} from "./filter-storefront-chart-rows";

export type SizeChartRowPublic = {
  measurementKey: string;
  label: string;
  /** Finished garment measurements for RTW — all rows shown in one table. */
  valuesBySize: Record<string, number>;
  sortOrder: number;
};

export type SizeChartComponentPublic = {
  componentKey: string;
  componentName: string;
  rows: SizeChartRowPublic[];
};

export type DesignSizeChartPublic = {
  sizeLabels: readonly string[];
  baseSizeLabel: string;
  notes: string | null;
  components: SizeChartComponentPublic[];
  /** True when showing house default because the design chart is empty. */
  isHouseDefault: boolean;
  /** Primary-piece overlay for ghost mannequin (when available). */
  overlay: {
    rows: GarmentChartRow[];
    silhouette: SilhouetteMode;
    silhouetteLabel: string;
  } | null;
};

const MEASUREMENT_DEF_BY_KEY = new Map(
  MEASUREMENT_KEY_DEFS.map((d) => [d.key, d]),
);

const CATEGORY_KEYS_BY_COMPONENT = new Map(
  GARMENT_CATEGORY_SEEDS.map((c) => [c.key, c.measurementKeys]),
);

const CATEGORY_NAME_BY_KEY = new Map(
  GARMENT_CATEGORY_SEEDS.map((c) => [c.key, c.name]),
);

function parsePrefixedKey(
  measurementKey: string,
  components: readonly string[],
): { componentKey: string; key: string } | null {
  for (const componentKey of components) {
    for (const sep of ["/", ":", "."] as const) {
      const prefix = `${componentKey}${sep}`;
      if (measurementKey.startsWith(prefix)) {
        return {
          componentKey,
          key: measurementKey.slice(prefix.length),
        };
      }
    }
  }
  return null;
}

function resolveRowComponent(
  measurementKey: string,
  components: readonly string[],
  primaryCategoryKey: string,
): string {
  const prefixed = parsePrefixedKey(measurementKey, components);
  if (prefixed) return prefixed.componentKey;

  const matching = components.filter((componentKey) =>
    (CATEGORY_KEYS_BY_COMPONENT.get(componentKey) ?? []).includes(
      measurementKey as MeasurementKeyCode,
    ),
  );

  if (matching.length === 1) return matching[0]!;
  if (matching.includes(primaryCategoryKey)) return primaryCategoryKey;
  if (matching.length > 0) return matching[0]!;
  return components[0] ?? primaryCategoryKey;
}

function resolveBareKey(
  measurementKey: string,
  components: readonly string[],
): string {
  const prefixed = parsePrefixedKey(measurementKey, components);
  return prefixed?.key ?? measurementKey;
}

function effectiveComponents(
  components: readonly string[],
  primaryCategoryKey: string,
): string[] {
  if (components.length > 0) return [...components];
  return [primaryCategoryKey];
}

type BlockMeta = {
  id: string;
  sizeLabels: string[];
  baseSizeLabel: string;
  notes: string | null;
  isDefault: boolean;
};

const BLOCK_COLUMNS = {
  id: sizeBlocks.id,
  sizeLabels: sizeBlocks.sizeLabels,
  baseSizeLabel: sizeBlocks.baseSizeLabel,
  notes: sizeBlocks.notes,
  isDefault: sizeBlocks.isDefault,
} as const;

async function loadActiveBlock(blockId: string): Promise<BlockMeta | null> {
  const [block] = await db
    .select(BLOCK_COLUMNS)
    .from(sizeBlocks)
    .where(and(eq(sizeBlocks.id, blockId), eq(sizeBlocks.active, true)))
    .limit(1);
  return block ?? null;
}

async function loadDefaultBlockForCategory(
  categoryKey: string,
): Promise<BlockMeta | null> {
  const [block] = await db
    .select(BLOCK_COLUMNS)
    .from(sizeBlocks)
    .innerJoin(
      garmentCategories,
      eq(sizeBlocks.categoryId, garmentCategories.id),
    )
    .where(
      and(
        eq(garmentCategories.key, categoryKey),
        eq(sizeBlocks.isDefault, true),
        eq(sizeBlocks.active, true),
      ),
    )
    .limit(1);
  return block ?? null;
}

function loadBlockRows(blockId: string) {
  return db
    .select({
      measurementKey: sizeBlockRows.measurementKey,
      baseValue: sizeBlockRows.baseValue,
      gradeIncrement: sizeBlockRows.gradeIncrement,
      gradeOverrides: sizeBlockRows.gradeOverrides,
      sortOrder: sizeBlockRows.sortOrder,
    })
    .from(sizeBlockRows)
    .where(eq(sizeBlockRows.blockId, blockId))
    .orderBy(asc(sizeBlockRows.sortOrder));
}

function loadPinnedCells(blockId: string) {
  return db
    .select({
      measurementKey: sizeBlockCells.measurementKey,
      sizeLabel: sizeBlockCells.sizeLabel,
      value: sizeBlockCells.value,
    })
    .from(sizeBlockCells)
    .where(
      and(eq(sizeBlockCells.blockId, blockId), eq(sizeBlockCells.isPinned, true)),
    );
}

function filterSizeLabels(
  blockLabels: readonly string[],
  availableSizeLabels?: readonly string[],
): string[] {
  if (!availableSizeLabels?.length) return [...blockLabels];
  const allowed = new Set(availableSizeLabels);
  return blockLabels.filter((label) => allowed.has(label));
}

async function resolveBlockForComponent(
  componentKey: string,
  input: {
    sizeBlockId: string | null;
    pieceSizeBlocks?: Record<string, string>;
    primaryCategoryKey: string;
  },
): Promise<{ block: BlockMeta; fromDesign: boolean } | null> {
  const pieceId = input.pieceSizeBlocks?.[componentKey];
  if (pieceId) {
    const block = await loadActiveBlock(pieceId);
    if (block) return { block, fromDesign: true };
  }

  if (
    componentKey === input.primaryCategoryKey &&
    input.sizeBlockId
  ) {
    const block = await loadActiveBlock(input.sizeBlockId);
    if (block) return { block, fromDesign: !block.isDefault };
  }

  const fallback = await loadDefaultBlockForCategory(componentKey);
  if (fallback) return { block: fallback, fromDesign: false };
  return null;
}

type LoadedSection = {
  componentKey: string;
  componentName: string;
  rows: SizeChartRowPublic[];
  garmentRows: GarmentChartRow[];
  block: BlockMeta;
  fromDesign: boolean;
  silhouette: SilhouetteMode;
  silhouetteLabel: string;
};

async function loadComponentSection(
  componentKey: string,
  componentKeys: readonly string[],
  primaryCategoryKey: string,
  input: {
    sizeBlockId: string | null;
    pieceSizeBlocks?: Record<string, string>;
    availableSizeLabels?: readonly string[];
  },
): Promise<LoadedSection | null> {
  const resolved = await resolveBlockForComponent(componentKey, {
    sizeBlockId: input.sizeBlockId,
    pieceSizeBlocks: input.pieceSizeBlocks,
    primaryCategoryKey,
  });
  if (!resolved) return null;

  let { block, fromDesign } = resolved;
  let rows = await loadBlockRows(block.id);

  if (rows.length === 0) {
    const fallback = await loadDefaultBlockForCategory(componentKey);
    if (fallback) {
      block = fallback;
      fromDesign = false;
      rows = await loadBlockRows(fallback.id);
    }
  }

  if (rows.length === 0) return null;

  const pinned = await loadPinnedCells(block.id);
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

  const sizeLabels = filterSizeLabels(
    block.sizeLabels,
    input.availableSizeLabels,
  );
  if (sizeLabels.length === 0) return null;

  const rawRows: SizeChartRowPublic[] = [];

  for (const row of rows) {
    const rowComponent = resolveRowComponent(
      row.measurementKey,
      componentKeys,
      primaryCategoryKey,
    );
    if (rowComponent !== componentKey) continue;

    const bareKey = resolveBareKey(row.measurementKey, componentKeys);
    const def = MEASUREMENT_DEF_BY_KEY.get(bareKey);
    if (!def) continue;

    const valuesBySize: Record<string, number> = {};
    for (const sizeLabel of sizeLabels) {
      valuesBySize[sizeLabel] =
        grid[row.measurementKey]?.[sizeLabel]?.value ?? row.baseValue;
    }

    rawRows.push({
      measurementKey: bareKey,
      label: def.label,
      valuesBySize,
      sortOrder: row.sortOrder,
    });
  }

  if (rawRows.length === 0) return null;

  const sorted = rawRows.sort((a, b) => a.sortOrder - b.sortOrder);
  const garmentRows = toGarmentChartRows(sorted);
  const filtered = filterStorefrontChartRows(sorted, block.baseSizeLabel);

  return {
    componentKey,
    componentName:
      CATEGORY_NAME_BY_KEY.get(componentKey) ??
      componentKey
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    rows: filtered.rows,
    garmentRows,
    block,
    fromDesign,
    silhouette: filtered.silhouette,
    silhouetteLabel: filtered.silhouetteLabel,
  };
}

export async function resolveDesignSizeChart(input: {
  sizeBlockId: string | null;
  pieceSizeBlocks?: Record<string, string>;
  components: readonly string[];
  primaryCategoryKey: string;
  availableSizeLabels?: readonly string[];
}): Promise<DesignSizeChartPublic | null> {
  const componentKeys = effectiveComponents(
    input.components,
    input.primaryCategoryKey,
  );

  const sections: LoadedSection[] = [];
  for (const componentKey of componentKeys) {
    const section = await loadComponentSection(
      componentKey,
      componentKeys,
      input.primaryCategoryKey,
      input,
    );
    if (section) sections.push(section);
  }

  if (sections.length === 0) return null;

  const primary =
    sections.find((s) => s.componentKey === input.primaryCategoryKey) ??
    sections[0]!;

  const sizeLabels = filterSizeLabels(
    primary.block.sizeLabels,
    input.availableSizeLabels,
  );
  if (sizeLabels.length === 0) return null;

  const isHouseDefault = sections.every((s) => !s.fromDesign);

  const overlayRows = displayGarmentChartRows(
    primary.garmentRows,
    primary.silhouette,
    primary.block.baseSizeLabel,
  );

  return {
    sizeLabels,
    baseSizeLabel: primary.block.baseSizeLabel,
    notes: primary.block.notes,
    isHouseDefault,
    overlay:
      overlayRows.length > 0
        ? {
            rows: overlayRows,
            silhouette: primary.silhouette,
            silhouetteLabel: primary.silhouetteLabel,
          }
        : null,
    components: sections.map((section) => ({
      componentKey: section.componentKey,
      componentName: section.componentName,
      rows: section.rows.map((row) => ({
        ...row,
        valuesBySize: Object.fromEntries(
          sizeLabels.map((label) => [label, row.valuesBySize[label]!]),
        ),
      })),
    })),
  };
}
