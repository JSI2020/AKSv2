import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Remove auto-seeded DEMO-* fabric lots (500m each from seed-demo / launch). Keeps user-recorded lots. */
async function main() {
  const { db, fabricLots, sql } = await import("@aks/db");
  const { like } = await import("drizzle-orm");

  const removed = await db
    .delete(fabricLots)
    .where(like(fabricLots.lotCode, "DEMO-%"))
    .returning({
      lotCode: fabricLots.lotCode,
      metersOnHand: fabricLots.metersOnHand,
      fabricId: fabricLots.fabricId,
    });

  for (const row of removed) {
    console.log(
      `  removed ${row.lotCode} — ${(row.metersOnHand / 100).toFixed(1)} m`,
    );
  }
  console.log(`\nRemoved ${removed.length} seeded lot(s). User lots unchanged.\n`);

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
