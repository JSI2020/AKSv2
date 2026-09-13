import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Step 3 — fabric lots + RTW on-hand for every published design. */
async function main() {
  const { uuidv7, STANDARD_SIZE_LABELS } = await import("@aks/shared");
  const { db, designs, fabricLots, fabrics, rtwStock, sql } = await import("@aks/db");
  const { eq } = await import("drizzle-orm");
  const { seedRtwStockForDesign } = await import("@/modules/inventory/rtw-stock");

  console.log("\n=== Launch Step 3: Inventory ===\n");

  const fabricRows = await db
    .select()
    .from(fabrics)
    .where(eq(fabrics.active, true));

  let lotsCreated = 0;
  const seedLots =
    process.env.SEED_LAUNCH_FABRIC_LOTS === "1" ||
    process.env.SEED_DEMO_FABRIC_LOTS === "1";

  if (seedLots) {
    for (const [i, fabric] of fabricRows.entries()) {
      const lotCode = `LAUNCH-${fabric.name.toUpperCase().replace(/\s+/g, "").slice(0, 10)}-${i + 1}`;
      const [existing] = await db
        .select({ id: fabricLots.id })
        .from(fabricLots)
        .where(eq(fabricLots.lotCode, lotCode))
        .limit(1);
      if (existing) continue;

      const meters = 50_000;
      await db.insert(fabricLots).values({
        id: uuidv7(),
        fabricId: fabric.id,
        lotCode,
        dyeLotRef: `DYE-LAUNCH-${2026}${String(i + 1).padStart(2, "0")}`,
        metersReceived: meters,
        metersOnHand: meters,
        metersReserved: 0,
        costPerMeterMinor: fabric.costPerMeterMinor,
        receivedAt: new Date(),
        colourNotes: "Launch stock",
        status: "AVAILABLE",
      });
      lotsCreated += 1;
    }
  } else {
    console.log("fabric lots: skipped (set SEED_LAUNCH_FABRIC_LOTS=1 to create)");
  }
  console.log(`fabric lots: ${lotsCreated} created`);

  const published = await db
    .select({
      id: designs.id,
      availableSizeLabels: designs.availableSizeLabels,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"));

  let rtwCreated = 0;
  for (const d of published) {
    const labels =
      d.availableSizeLabels?.length > 0
        ? d.availableSizeLabels
        : STANDARD_SIZE_LABELS.filter((l) => l !== "XXL");
    rtwCreated += await db.transaction((tx) =>
      seedRtwStockForDesign(tx, d.id, labels),
    );
  }

  const qtyUpdate = await sql<{ id: string }[]>`
    update rtw_stock
    set quantity_on_hand = 5, updated_at = now()
    where design_id in (select id from designs where status = 'PUBLISHED')
    returning id`;

  console.log(`RTW: ${rtwCreated} new row(s), ${qtyUpdate.length} set to qty 5`);
  console.log(`\nStep 3 complete. Next: npm run launch:4\n`);

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
