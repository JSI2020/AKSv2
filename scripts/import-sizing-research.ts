import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Import Pakistani womenswear research pack into measurement_keys,
 * garment_categories, and default size blocks.
 *
 * Source CSVs: data/sizing-research/
 * Regenerate TS seeds first: npm run db:generate:sizing-research
 *
 * Run: npm run db:import:sizing-research
 */
async function main() {
  const {
    DEFAULT_BASE_SIZE_LABEL,
    DEFAULT_SIZE_BLOCK_SEEDS,
    GARMENT_CATEGORY_SEEDS,
    MEASUREMENT_KEY_DEFS,
    STANDARD_SIZE_LABELS,
    uuidv7,
  } = await import("@aks/shared");
  const {
    db,
    garmentCategories,
    measurementKeys,
    sizeBlockRows,
    sizeBlocks,
    sql,
  } = await import("@aks/db");
  const { and, eq } = await import("drizzle-orm");

  const forceRows = process.argv.includes("--force-rows");

  for (const def of MEASUREMENT_KEY_DEFS) {
    await db
      .insert(measurementKeys)
      .values({
        key: def.key,
        label: def.label,
        labelUr: def.labelUr,
        bodyOrGarment: def.bodyOrGarment,
        anchorPoint: def.anchorPoint,
        helpText: def.helpText,
      })
      .onConflictDoUpdate({
        target: measurementKeys.key,
        set: {
          label: def.label,
          labelUr: def.labelUr,
          bodyOrGarment: def.bodyOrGarment,
          anchorPoint: def.anchorPoint,
          helpText: def.helpText,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`[import] measurement_keys: ${MEASUREMENT_KEY_DEFS.length}`);

  for (const cat of GARMENT_CATEGORY_SEEDS) {
    const existing = await db
      .select({ id: garmentCategories.id })
      .from(garmentCategories)
      .where(eq(garmentCategories.key, cat.key))
      .limit(1);

    if (existing[0]) {
      await db
        .update(garmentCategories)
        .set({
          name: cat.name,
          nameUr: cat.nameUr,
          measurementKeys: [...cat.measurementKeys],
          sortOrder: cat.sortOrder,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(garmentCategories.id, existing[0].id));
    } else {
      await db.insert(garmentCategories).values({
        id: uuidv7(),
        key: cat.key,
        name: cat.name,
        nameUr: cat.nameUr,
        measurementKeys: [...cat.measurementKeys],
        active: true,
        sortOrder: cat.sortOrder,
      });
    }
  }
  console.log(`[import] garment_categories: ${GARMENT_CATEGORY_SEEDS.length}`);

  const categories = await db
    .select({ id: garmentCategories.id, key: garmentCategories.key })
    .from(garmentCategories);
  const categoryIdByKey = new Map(categories.map((c) => [c.key, c.id]));

  for (const blockSeed of DEFAULT_SIZE_BLOCK_SEEDS) {
    const categoryId = categoryIdByKey.get(blockSeed.categoryKey);
    if (!categoryId) {
      console.warn("[import] skip block — no category", blockSeed.categoryKey);
      continue;
    }

    const sizeLabels = blockSeed.sizeLabels ?? [...STANDARD_SIZE_LABELS];
    const baseSizeLabel = blockSeed.baseSizeLabel ?? DEFAULT_BASE_SIZE_LABEL;

    let [def] = await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.categoryId, categoryId),
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
        categoryId,
        isDefault: true,
        ownerDesignId: null,
        sizeLabels: [...sizeLabels],
        baseSizeLabel,
        notes: blockSeed.notes,
        active: true,
      });
      def = { id };
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

    if (existingRows.length === 0 || forceRows) {
      if (forceRows && existingRows.length > 0) {
        await db
          .delete(sizeBlockRows)
          .where(eq(sizeBlockRows.blockId, def.id));
      }
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
      console.log(
        `[import] block ${blockSeed.categoryKey}: ${blockSeed.rows.length} rows`,
      );
    }
  }

  console.log(
    "[import] complete. Raw observations remain in data/sizing-research/ as evidence only.",
  );

  const { ensureDefaultSizeBlocksForAllCategories } = await import(
    "../modules/sizing/ensure-default-blocks"
  );
  const parity = await ensureDefaultSizeBlocksForAllCategories();
  console.log(
    `[import] parity: ${parity.defaultBlocksTotal}/${parity.categoriesTotal} categories have default charts` +
      (parity.blocksCreated ? ` (${parity.blocksCreated} blocks created)` : "") +
      (parity.rowSetsFilled ? ` (${parity.rowSetsFilled} row sets filled)` : ""),
  );

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
