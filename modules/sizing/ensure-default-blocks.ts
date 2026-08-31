"use server";

import { and, eq } from "drizzle-orm";

import {
  db,
  garmentCategories,
  sizeBlockRows,
  sizeBlocks,
} from "@aks/db";
import {
  DEFAULT_BASE_SIZE_LABEL,
  DEFAULT_SIZE_BLOCK_SEEDS,
  GARMENT_CATEGORY_SEEDS,
  STANDARD_SIZE_LABELS,
  inches,
  metres,
  uuidv7,
  type SizeBlockSeed,
} from "@aks/shared";

function seedForCategory(categoryKey: string): SizeBlockSeed | undefined {
  return DEFAULT_SIZE_BLOCK_SEEDS.find((s) => s.categoryKey === categoryKey);
}

function placeholderForCategory(
  cat: typeof garmentCategories.$inferSelect,
): SizeBlockSeed {
  const meta = GARMENT_CATEGORY_SEEDS.find((c) => c.key === cat.key);
  const productType = meta?.productType;
  const isFabric = productType === "fabric";
  const isAccessory = productType === "accessory";
  const status = meta?.evidenceStatus ?? "Proposed";

  const defaultBaseForKey = (key: string): number => {
    if (isFabric) {
      if (key.includes("WIDTH")) return metres(1.1);
      return metres(2.5);
    }
    if (/^(BUST|CHEST|HIP|WAIST|LOWER_WAIST|UPPER_WAIST)/.test(key)) {
      return inches(36);
    }
    if (/^(SHOULDER|RISE|ARMHOLE|SLEEVE)/.test(key)) return inches(14);
    if (/^(LENGTH|SWEEP|BOTTOM_OPENING|THIGH|KNEE)/.test(key)) {
      return inches(38);
    }
    if (key === "WIDTH") return inches(36);
    return inches(30);
  };

  return {
    categoryKey: cat.key,
    name: `${cat.key} default (${status.toLowerCase()})`,
    notes:
      status === "Measured"
        ? "Category has research evidence but no default chart was derived yet — replace with house blocks."
        : status === "Confirmed"
          ? "Confirmed category — replace placeholder numbers with designer pattern blocks before production."
          : "Proposed category — configure when the house adopts this silhouette.",
    sizeLabels:
      isFabric || isAccessory ? ["One size"] : [...STANDARD_SIZE_LABELS],
    baseSizeLabel:
      isFabric || isAccessory ? "One size" : DEFAULT_BASE_SIZE_LABEL,
    rows: cat.measurementKeys.map((key, i) => ({
      measurementKey: key,
      baseValue: defaultBaseForKey(key),
      gradeIncrement: isFabric || isAccessory ? 0 : inches(2),
      sortOrder: (i + 1) * 10,
    })),
  };
}

export type EnsureDefaultBlocksResult = {
  blocksCreated: number;
  rowSetsFilled: number;
  categoriesTotal: number;
  defaultBlocksTotal: number;
};

/**
 * Guarantee one active default size block (with rows) per garment category.
 * Safe to call repeatedly — only creates missing blocks / empty row sets.
 */
export async function ensureDefaultSizeBlocksForAllCategories(): Promise<EnsureDefaultBlocksResult> {
  const categories = await db
    .select()
    .from(garmentCategories)
    .where(eq(garmentCategories.active, true))
    .orderBy(garmentCategories.sortOrder);

  let blocksCreated = 0;
  let rowSetsFilled = 0;

  for (const cat of categories) {
    const blockSeed =
      seedForCategory(cat.key) ?? placeholderForCategory(cat);
    const sizeLabels = blockSeed.sizeLabels ?? [...STANDARD_SIZE_LABELS];
    const baseSizeLabel =
      blockSeed.baseSizeLabel ?? DEFAULT_BASE_SIZE_LABEL;

    let [def] = await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.categoryId, cat.id),
          eq(sizeBlocks.isDefault, true),
          eq(sizeBlocks.active, true),
        ),
      )
      .limit(1);

    if (!def) {
      const id = uuidv7();
      await db.insert(sizeBlocks).values({
        id,
        name: blockSeed.name,
        categoryId: cat.id,
        isDefault: true,
        ownerDesignId: null,
        sizeLabels: [...sizeLabels],
        baseSizeLabel,
        notes: blockSeed.notes,
        active: true,
      });
      def = { id };
      blocksCreated += 1;
    } else {
      await db
        .update(sizeBlocks)
        .set({
          name: blockSeed.name,
          sizeLabels: [...sizeLabels],
          baseSizeLabel,
          notes: blockSeed.notes,
          updatedAt: new Date(),
        })
        .where(eq(sizeBlocks.id, def.id));
    }

    const existingRows = await db
      .select({ id: sizeBlockRows.id })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, def.id));

    if (existingRows.length === 0) {
      for (const row of blockSeed.rows) {
        await db.insert(sizeBlockRows).values({
          id: uuidv7(),
          blockId: def.id,
          measurementKey: row.measurementKey,
          baseValue: row.baseValue,
          gradeIncrement: row.gradeIncrement,
          gradeOverrides: row.gradeOverrides ?? {},
          sortOrder: row.sortOrder,
        });
      }
      rowSetsFilled += 1;
    }
  }

  const defaultBlocksTotal = (
    await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(and(eq(sizeBlocks.isDefault, true), eq(sizeBlocks.active, true)))
  ).length;

  return {
    blocksCreated,
    rowSetsFilled,
    categoriesTotal: categories.length,
    defaultBlocksTotal,
  };
}
