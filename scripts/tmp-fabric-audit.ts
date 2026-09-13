import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, fabrics, fabricLots } = await import("@aks/db");
  const { eq, asc } = await import("drizzle-orm");
  const { lotAvailableMeters } = await import("@/modules/inventory/lot-status");

  const rows = await db
    .select({
      id: fabrics.id,
      name: fabrics.name,
      reorder: fabrics.reorderPointMeters,
    })
    .from(fabrics)
    .where(eq(fabrics.active, true))
    .orderBy(asc(fabrics.name));

  for (const f of rows) {
    console.log(`\n=== ${f.name} (${f.id}) reorder=${f.reorder / 100}m ===`);
    const lots = await db
      .select()
      .from(fabricLots)
      .where(eq(fabricLots.fabricId, f.id))
      .orderBy(asc(fabricLots.receivedAt));

    let ohActive = 0;
    let rActive = 0;
    let avActive = 0;
    for (const l of lots) {
      const av = lotAvailableMeters(l);
      const active = l.status === "AVAILABLE" || l.status === "LOW";
      console.log(
        `  lot ${l.lotCode.padEnd(12)} status=${l.status.padEnd(11)} onHand=${(l.metersOnHand / 100).toFixed(2)}m reserved=${(l.metersReserved / 100).toFixed(2)}m avail=${(av / 100).toFixed(2)}m colourway=${l.colourwayId ?? "null"} received=${l.receivedAt.toISOString().slice(0, 10)} ${active ? "COUNTED" : "EXCLUDED"}`,
      );
      if (active) {
        ohActive += l.metersOnHand;
        rActive += l.metersReserved;
        avActive += av;
      }
    }
    console.log(
      `  ACTIVE TOTALS: onHand=${(ohActive / 100).toFixed(2)}m reserved=${(rActive / 100).toFixed(2)}m available=${(avActive / 100).toFixed(2)}m (${lots.length} lots, ${lots.filter((l) => l.status === "AVAILABLE" || l.status === "LOW").length} active)`,
    );
  }

  const { sql } = await import("@aks/db");
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
