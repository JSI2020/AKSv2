import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Wire fabric master swatches onto inventory colourways (one-time repair). */
async function main() {
  const { db, fabrics, sql } = await import("@aks/db");
  const { asc } = await import("drizzle-orm");
  const {
    ensureFabricColourways,
    syncFabricColourwaySwatches,
  } = await import("@/modules/inventory/ledger-queries");

  const rows = await db
    .select({ id: fabrics.id, name: fabrics.name })
    .from(fabrics)
    .orderBy(asc(fabrics.name));

  console.log(`\nRepairing ${rows.length} fabrics…\n`);
  for (const row of rows) {
    await ensureFabricColourways(row.id);
    await syncFabricColourwaySwatches(row.id);
    console.log(`  ${row.name}`);
  }

  const check = await sql<
    { cw_no_swatch: number }[]
  >`select count(*)::int as cw_no_swatch from fabric_colourways where swatch_asset_id is null`;
  console.log(`\nColourways still missing swatch: ${check[0]?.cw_no_swatch ?? "?"}\n`);
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
