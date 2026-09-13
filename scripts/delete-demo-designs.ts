import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Delete draft/published designs with slug demo-* (launch catalogue leftovers). */
async function main() {
  const { and, eq, inArray, like } = await import("drizzle-orm");
  const {
    cartLines,
    db,
    designCosts,
    designs,
    rtwMovements,
    rtwStock,
    sql,
  } = await import("@aks/db");

  const demoDesigns = await db
    .select({ id: designs.id, slug: designs.slug, status: designs.status })
    .from(designs)
    .where(like(designs.slug, "demo-%"));

  if (demoDesigns.length === 0) {
    console.log("No demo-* designs found.");
    await sql.end({ timeout: 5 });
    return;
  }

  const ids = demoDesigns.map((d) => d.id);
  console.log(`Removing ${ids.length} demo-* design(s)…`);

  const cartDeleted = await db
    .delete(cartLines)
    .where(inArray(cartLines.designId, ids))
    .returning({ id: cartLines.id });
  console.log(`  cart_lines: ${cartDeleted.length}`);

  const rtwRows = await db
    .select({ id: rtwStock.id })
    .from(rtwStock)
    .where(inArray(rtwStock.designId, ids));
  if (rtwRows.length) {
    await db.delete(rtwMovements).where(
      inArray(
        rtwMovements.rtwStockId,
        rtwRows.map((r) => r.id),
      ),
    );
    await db.delete(rtwStock).where(inArray(rtwStock.designId, ids));
    console.log(`  rtw_stock: ${rtwRows.length}`);
  }

  await db.delete(designCosts).where(inArray(designCosts.designId, ids));

  const removed = await db
    .delete(designs)
    .where(and(inArray(designs.id, ids), like(designs.slug, "demo-%")))
    .returning({ slug: designs.slug });

  console.log(`  designs deleted: ${removed.length}`);
  for (const row of removed.slice(0, 5)) {
    console.log(`    · ${row.slug}`);
  }
  if (removed.length > 5) console.log(`    … and ${removed.length - 5} more`);

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
