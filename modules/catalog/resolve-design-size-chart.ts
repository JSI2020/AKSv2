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
  type BodyOrGarment,
  type MeasurementKeyCode,
} from "@aks/shared";

import { resolveChart } from "@/modules/sizing/engine";

export type SizeChartRowPublic = {
  measurementKey: string;
  label: string;
  bodyOrGarment: BodyOrGarment;
  /** sizeLabel → hundredths of an inch */
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
};

const BLOCK_COLUMNS = {
  id: sizeBlocks.id,
  sizeLabels: sizeBlocks.sizeLabels,
  baseSizeLabel: sizeBlocks.baseSizeLabel,
  notes: sizeBlocks.notes,
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

export async function resolveDesignSizeChart(input: {
  sizeBlockId: string | null;
  components: readonly string[];
  primaryCategoryKey: string;
}): Promise<DesignSizeChartPublic | null> {
  // Prefer the design's own block. When it has no rows (not yet forked/sized)
  // or no block is set, fall back to the category's active default block so the
  // storefront still shows a complete, correct size chart instead of nothing.
  let block = input.sizeBlockId
    ? await loadActiveBlock(input.sizeBlockId)
    : null;
  let rows = block ? await loadBlockRows(block.id) : [];

  if (rows.length === 0) {
    const fallback = await loadDefaultBlockForCategory(input.primaryCategoryKey);
    if (fallback) {
      block = fallback;
      rows = await loadBlockRows(fallback.id);
    }
  }

  if (!block || rows.length === 0) return null;

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

  const componentKeys = effectiveComponents(
    input.components,
    input.primaryCategoryKey,
  );

  const grouped = new Map<string, SizeChartRowPublic[]>();
  for (const componentKey of componentKeys) {
    grouped.set(componentKey, []);
  }

  for (const row of rows) {
    const componentKey = resolveRowComponent(
      row.measurementKey,
      componentKeys,
      input.primaryCategoryKey,
    );
    const bareKey = resolveBareKey(row.measurementKey, componentKeys);
    const def = MEASUREMENT_DEF_BY_KEY.get(bareKey);
    if (!def) continue;

    const valuesBySize: Record<string, number> = {};
    for (const sizeLabel of block.sizeLabels) {
      valuesBySize[sizeLabel] =
        grid[row.measurementKey]?.[sizeLabel]?.value ?? row.baseValue;
    }

    grouped.get(componentKey)?.push({
      measurementKey: bareKey,
      label: def.label,
      bodyOrGarment: def.bodyOrGarment,
      valuesBySize,
      sortOrder: row.sortOrder,
    });
  }

  const components: SizeChartComponentPublic[] = componentKeys
    .map((componentKey) => ({
      componentKey,
      componentName:
        CATEGORY_NAME_BY_KEY.get(componentKey) ??
        componentKey
          .toLowerCase()
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      rows: (grouped.get(componentKey) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    }))
    .filter((section) => section.rows.length > 0);

  if (components.length === 0) return null;

  return {
    sizeLabels: block.sizeLabels,
    baseSizeLabel: block.baseSizeLabel,
    notes: block.notes,
    components,
  };
}
