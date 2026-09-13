import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Backfill receive rows in stock_adjustments for lots that have on-hand stock
 * but no positive receive adjustment (pre-ledger-fix lots).
 */
async function main() {
  const { db, fabricLots, sql, stockAdjustments, users } = await import("@aks/db");
  const { eq, sql: dsql } = await import("drizzle-orm");
  const { uuidv7 } = await import("@aks/shared");

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER user");

  const lots = await db
    .select({
      id: fabricLots.id,
      lotCode: fabricLots.lotCode,
      metersReceived: fabricLots.metersReceived,
      receivedAt: fabricLots.receivedAt,
    })
    .from(fabricLots);

  let created = 0;
  for (const lot of lots) {
    if (lot.metersReceived <= 0) continue;

    const [sumRow] = await db
      .select({
        total: dsql<number>`coalesce(sum(${stockAdjustments.deltaMeters}), 0)::int`,
      })
      .from(stockAdjustments)
      .where(eq(stockAdjustments.fabricLotId, lot.id));

    const recorded = Number(sumRow?.total ?? 0);
    if (recorded >= lot.metersReceived) continue;

    const delta = lot.metersReceived - Math.max(0, recorded);
    await db.insert(stockAdjustments).values({
      id: uuidv7(),
      fabricLotId: lot.id,
      deltaMeters: delta,
      reason: "OTHER",
      note: `Backfill receive — lot ${lot.lotCode}`,
      actorId: owner.id,
      createdAt: lot.receivedAt,
    });
    created += 1;
    console.log(`  ${lot.lotCode}: +${(delta / 100).toFixed(2)}m`);
  }

  console.log(`\nBackfilled ${created} lot(s).`);
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
