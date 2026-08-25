import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Ensure every category default size block has measurement rows.
 * Empty placeholders leave the Design Sizing tab stuck on "Loading…".
 *
 * Run: npx tsx scripts/ensure-default-size-block-rows.ts
 */
async function main() {
  const {
    db,
    designs,
    garmentCategories,
    sizeBlockRows,
    sizeBlocks,
    sql,
  } = await import("@aks/db");
  const {
    DEFAULT_BASE_SIZE_LABEL,
    DEFAULT_SIZE_BLOCK_SEEDS,
    STANDARD_SIZE_LABELS,
    uuidv7,
  } = await import("@aks/shared");
  const { and, eq, sql: dsql } = await import("drizzle-orm");

  const cats = await db
    .select({ id: garmentCategories.id, key: garmentCategories.key })
    .from(garmentCategories);
  const catIdByKey = new Map(cats.map((c) => [c.key, c.id]));

  for (const seed of DEFAULT_SIZE_BLOCK_SEEDS) {
    const categoryId = catIdByKey.get(seed.categoryKey);
    if (!categoryId) {
      console.warn("skip — no category", seed.categoryKey);
      continue;
    }

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
        name: seed.name,
        categoryId,
        isDefault: true,
        ownerDesignId: null,
        sizeLabels: [...STANDARD_SIZE_LABELS],
        baseSizeLabel: DEFAULT_BASE_SIZE_LABEL,
        notes: seed.notes,
        active: true,
      });
      def = { id };
      console.log("created default block", seed.categoryKey, id);
    }

    const existingRows = await db
      .select({ id: sizeBlockRows.id })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, def.id));

    if (existingRows.length === 0) {
      for (const row of seed.rows) {
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
        "filled rows",
        seed.categoryKey,
        seed.rows.length,
        "→",
        def.id,
      );
    } else {
      console.log(
        "ok",
        seed.categoryKey,
        existingRows.length,
        "rows on",
        def.id,
      );
    }
  }

  // Drop empty design forks and clear designs.pieceSizeBlocks pointing at them
  const emptyForks = await db
    .select({
      id: sizeBlocks.id,
      ownerDesignId: sizeBlocks.ownerDesignId,
      categoryId: sizeBlocks.categoryId,
    })
    .from(sizeBlocks)
    .where(
      and(
        dsql`${sizeBlocks.ownerDesignId} is not null`,
        eq(sizeBlocks.active, true),
      ),
    );

  for (const fork of emptyForks) {
    const rows = await db
      .select({ id: sizeBlockRows.id })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, fork.id));
    if (rows.length > 0) continue;

    console.log("removing empty fork", fork.id, "owner", fork.ownerDesignId);
    if (fork.ownerDesignId) {
      const [design] = await db
        .select({
          id: designs.id,
          sizeBlockId: designs.sizeBlockId,
          pieceSizeBlocks: designs.pieceSizeBlocks,
        })
        .from(designs)
        .where(eq(designs.id, fork.ownerDesignId))
        .limit(1);
      if (design) {
        const nextPieces = { ...(design.pieceSizeBlocks ?? {}) };
        for (const [k, v] of Object.entries(nextPieces)) {
          if (v === fork.id) delete nextPieces[k];
        }
        await db
          .update(designs)
          .set({
            pieceSizeBlocks: nextPieces,
            sizeBlockId:
              design.sizeBlockId === fork.id ? null : design.sizeBlockId,
            updatedAt: new Date(),
          })
          .where(eq(designs.id, design.id));
      }
    }
    await db.delete(sizeBlocks).where(eq(sizeBlocks.id, fork.id));
  }

  console.log("Done. Refresh Design → Sizing.");
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
