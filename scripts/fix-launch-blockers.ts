import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Slugs created by integration tests — not real catalogue pieces. */
const UNPUBLISH_SLUG_PREFIXES = [
  "manual-order-",
  "test-design-",
  "production-design-",
  "inv-design-",
] as const;

/**
 * Cleans test-published junk and seeds demo RTW qty so the storefront can sell.
 * Run after `audit:launch-catalogue` reports blockers on fixture designs.
 */
async function main() {
  const { db, designs, rtwStock, sizeBlockRows, sizeBlocks, garmentCategories, sql } =
    await import("@aks/db");
  const { eq, like, or, and, sql: dsql } = await import("drizzle-orm");
  const { seedRtwStockForDesign } = await import(
    "@/modules/inventory/rtw-stock"
  );
  const { STANDARD_SIZE_LABELS } = await import("@aks/shared");
  const { execSync } = await import("node:child_process");

  execSync("npx tsx scripts/ensure-default-size-block-rows.ts", {
    stdio: "inherit",
    env: process.env,
  });

  const junk = await db
    .select({ id: designs.id, slug: designs.slug, name: designs.name })
    .from(designs)
    .where(
      or(
        ...UNPUBLISH_SLUG_PREFIXES.map((p) => like(designs.slug, `${p}%`)),
      ),
    );

  let unpublished = 0;
  for (const d of junk) {
    if (d.slug.startsWith("demo-")) continue;
    await db
      .update(designs)
      .set({ status: "DRAFT", publishedAt: null, updatedAt: new Date() })
      .where(eq(designs.id, d.id));
    unpublished += 1;
    console.log(`unpublished fixture: ${d.slug}`);
  }

  const published = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      availableSizeLabels: designs.availableSizeLabels,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"));

  let seeded = 0;
  for (const d of published) {
    const labels =
      d.availableSizeLabels?.length > 0
        ? d.availableSizeLabels
        : STANDARD_SIZE_LABELS.filter((l) => l !== "XXL");
    const created = await db.transaction((tx) =>
      seedRtwStockForDesign(tx, d.id, labels),
    );
    seeded += created;
  }

  const demoQty = await db
    .update(rtwStock)
    .set({ quantityOnHand: 5, updatedAt: new Date() })
    .where(
      dsql`${rtwStock.designId} in (
        select id from designs where slug like 'demo-%' and status = 'PUBLISHED'
      ) and ${rtwStock.quantityOnHand} = 0`,
    )
    .returning({ id: rtwStock.id });

  // Point published designs at empty forks back to the category default block.
  const broken = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      sizeBlockId: designs.sizeBlockId,
      garmentTypeId: designs.garmentTypeId,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"));

  let sizeFixed = 0;
  for (const d of broken) {
    if (!d.sizeBlockId) {
      const [def] = await db
        .select({ id: sizeBlocks.id })
        .from(sizeBlocks)
        .where(
          and(
            eq(sizeBlocks.categoryId, d.garmentTypeId),
            eq(sizeBlocks.isDefault, true),
            eq(sizeBlocks.active, true),
          ),
        )
        .limit(1);
      if (!def) continue;
      await db
        .update(designs)
        .set({ sizeBlockId: def.id, updatedAt: new Date() })
        .where(eq(designs.id, d.id));
      sizeFixed += 1;
      console.log(`fixed size block: ${d.slug} → default ${def.id}`);
      continue;
    }

    const rows = await db
      .select({ id: sizeBlockRows.id })
      .from(sizeBlockRows)
      .where(eq(sizeBlockRows.blockId, d.sizeBlockId))
      .limit(1);
    if (rows.length > 0) continue;

    const [def] = await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.categoryId, d.garmentTypeId),
          eq(sizeBlocks.isDefault, true),
          eq(sizeBlocks.active, true),
        ),
      )
      .limit(1);
    if (!def) continue;

    await db
      .update(designs)
      .set({ sizeBlockId: def.id, updatedAt: new Date() })
      .where(eq(designs.id, d.id));
    sizeFixed += 1;
    console.log(`fixed size block: ${d.slug} → default ${def.id}`);
  }

  console.log(
    `\nDone: ${unpublished} fixture(s) unpublished, ${seeded} new RTW row(s), ${demoQty.length} demo size(s) set to qty 5, ${sizeFixed} size block(s) repaired.`,
  );

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
