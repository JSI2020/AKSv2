import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Delete fabrics with no swatch photo. Reassigns design colourways to a fabric that has a swatch. */
async function main() {
  const {
    db,
    assets,
    colourways,
    designCosts,
    fabrics,
    fabricLots,
    fabricReservations,
    purchaseOrderLines,
    stockAdjustments,
    sql,
  } = await import("@aks/db");
  const {
    and,
    count,
    eq,
    inArray,
    isNotNull,
    isNull,
    or,
    sql: dsql,
  } = await import("drizzle-orm");

  const [fallback] = await db
    .select({ id: fabrics.id, name: fabrics.name })
    .from(fabrics)
    .where(and(isNotNull(fabrics.swatchAssetId), eq(fabrics.active, true)))
    .orderBy(fabrics.name)
    .limit(1);

  if (!fallback) {
    console.error(
      "No fabric with a swatch photo found — run npm run db:seed:fabrics first.",
    );
    process.exit(1);
  }

  console.log(`Fallback fabric for reassign: ${fallback.name}\n`);

  // Bind the narrowed value: the guard above narrows `fallback`, but TS widens
  // it again inside the nested reassign function that captures it.
  const fallbackFabric = fallback;

  async function reassignFabricReferences(fabricId: string): Promise<void> {
    const cwRows = await db
      .select({
        id: colourways.id,
        fabricId: colourways.fabricId,
        pieceFabrics: colourways.pieceFabrics,
        designId: colourways.designId,
      })
      .from(colourways)
      .where(
        or(
          eq(colourways.fabricId, fabricId),
          dsql`EXISTS (SELECT 1 FROM jsonb_each_text(${colourways.pieceFabrics}) AS t(k, v) WHERE t.v = ${fabricId})`,
        ),
      );

    for (const cw of cwRows) {
      const pieces = { ...(cw.pieceFabrics ?? {}) };
      for (const [key, value] of Object.entries(pieces)) {
        if (value === fabricId) pieces[key] = fallbackFabric.id;
      }
      await db
        .update(colourways)
        .set({
          fabricId: cw.fabricId === fabricId ? fallbackFabric.id : cw.fabricId,
          pieceFabrics: pieces,
          updatedAt: new Date(),
        })
        .where(eq(colourways.id, cw.id));
    }

    const costRows = await db
      .select({
        designId: designCosts.designId,
        fabricId: designCosts.fabricId,
        pieceCosts: designCosts.pieceCosts,
      })
      .from(designCosts)
      .where(
        or(
          eq(designCosts.fabricId, fabricId),
          dsql`EXISTS (SELECT 1 FROM jsonb_array_elements(${designCosts.pieceCosts}) AS elem WHERE elem->>'fabricId' = ${fabricId})`,
        ),
      );

    for (const row of costRows) {
      const pieceCosts = Array.isArray(row.pieceCosts)
        ? row.pieceCosts.map((entry) => {
            if (entry?.fabricId === fabricId) {
              return { ...entry, fabricId: fallbackFabric.id };
            }
            return entry;
          })
        : row.pieceCosts;

      await db
        .update(designCosts)
        .set({
          fabricId: row.fabricId === fabricId ? fallbackFabric.id : row.fabricId,
          pieceCosts,
          updatedAt: new Date(),
        })
        .where(eq(designCosts.designId, row.designId));
    }
  }

  async function deleteFabricRow(fabricId: string): Promise<void> {
    const lotRows = await db
      .select({ id: fabricLots.id })
      .from(fabricLots)
      .where(eq(fabricLots.fabricId, fabricId));
    const lotIds = lotRows.map((row) => row.id);

    await db.transaction(async (tx) => {
      if (lotIds.length > 0) {
        await tx
          .delete(stockAdjustments)
          .where(inArray(stockAdjustments.fabricLotId, lotIds));
        await tx
          .delete(fabricReservations)
          .where(inArray(fabricReservations.fabricLotId, lotIds));
        await tx.delete(fabricLots).where(eq(fabricLots.fabricId, fabricId));
      }
      await tx.delete(fabrics).where(eq(fabrics.id, fabricId));
    });
  }

  const candidates = await db
    .select({
      id: fabrics.id,
      name: fabrics.name,
    })
    .from(fabrics)
    .where(isNull(fabrics.swatchAssetId))
    .orderBy(fabrics.name);

  if (candidates.length === 0) {
    console.log("No fabrics without a swatch photo.");
    await sql.end({ timeout: 5 });
    return;
  }

  console.log(`Found ${candidates.length} fabric(s) without swatch photo:\n`);

  let deleted = 0;
  let skipped = 0;

  for (const fabric of candidates) {
    const [poUse] = await db
      .select({ count: count() })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.fabricId, fabric.id));

    const [reservedUse] = await db
      .select({ count: count() })
      .from(fabricReservations)
      .innerJoin(fabricLots, eq(fabricReservations.fabricLotId, fabricLots.id))
      .where(
        and(
          eq(fabricLots.fabricId, fabric.id),
          eq(fabricReservations.status, "RESERVED"),
        ),
      );

    const blocked =
      (poUse?.count ?? 0) > 0
        ? "referenced on a purchase order"
        : null;

    if (blocked) {
      console.log(`  SKIP  ${fabric.name} — ${blocked}`);
      skipped += 1;
      continue;
    }

    if ((reservedUse?.count ?? 0) > 0) {
      const lotRows = await db
        .select({ id: fabricLots.id })
        .from(fabricLots)
        .where(eq(fabricLots.fabricId, fabric.id));
      const lotIds = lotRows.map((row) => row.id);
      if (lotIds.length > 0) {
        await db
          .delete(fabricReservations)
          .where(inArray(fabricReservations.fabricLotId, lotIds));
      }
    }

    await reassignFabricReferences(fabric.id);
    await deleteFabricRow(fabric.id);
    console.log(`  DEL   ${fabric.name}`);
    deleted += 1;
  }

  const [remaining] = await db
    .select({ count: count() })
    .from(fabrics)
    .where(isNull(fabrics.swatchAssetId));

  console.log(
    `\nDone — deleted ${deleted}, skipped ${skipped}, ${remaining?.count ?? 0} without swatch remain.`,
  );

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
