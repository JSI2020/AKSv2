import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Demo packing materials, trims, and sample RTW stock for inventory ledger UI.
 * Run: npm run db:seed:inventory
 */
async function main() {
  const {
    db,
    packingMaterials,
    trims,
    trimColourways,
    trimStock,
    rtwStock,
    designs,
    colourways,
    sql,
  } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");
  const { and, eq } = await import("drizzle-orm");

  console.log("Seeding inventory ledger demo…");

  const packing = [
    { name: "Shipping box — medium", onHand: 14, reorder: 30 },
    { name: "Tissue paper set", onHand: 120, reorder: 50 },
    { name: "Garment bag", onHand: 18, reorder: 40 },
    { name: "Thank-you card", onHand: 210, reorder: 60 },
  ];

  for (const p of packing) {
    const existing = await db
      .select({ id: packingMaterials.id })
      .from(packingMaterials)
      .where(eq(packingMaterials.name, p.name))
      .limit(1);
    if (existing[0]) {
      console.log("packing exists", p.name);
      continue;
    }
    await db.insert(packingMaterials).values({
      id: uuidv7(),
      name: p.name,
      quantityOnHand: p.onHand,
      quantityReserved: 0,
      reorderPoint: p.reorder,
      costPerUnitMinor: 0,
      active: true,
    });
    console.log("packing", p.name);
  }

  const trimDefs = [
    {
      name: "Button — 12mm",
      kind: "BUTTON" as const,
      colours: [
        { name: "Antique gold", hex: "#9A8A6B", onHand: 340 },
        { name: "Stone", hex: "#A89A80", onHand: 120 },
      ],
    },
    {
      name: "Zip — 7 inch",
      kind: "ZIP" as const,
      colours: [
        { name: "Ivory", hex: "#EAE1CF", onHand: 80 },
        { name: "Black", hex: "#22283A", onHand: 60 },
      ],
    },
    {
      name: "Lining",
      kind: "LINING" as const,
      colours: [
        { name: "Ivory", hex: "#EAE1CF", onHand: 45 },
        { name: "Bone", hex: "#DDD2BC", onHand: 30 },
      ],
    },
  ];

  for (const t of trimDefs) {
    const existing = await db
      .select({ id: trims.id })
      .from(trims)
      .where(eq(trims.name, t.name))
      .limit(1);
    let trimId = existing[0]?.id;
    if (!trimId) {
      trimId = uuidv7();
      await db.insert(trims).values({
        id: trimId,
        name: t.name,
        type: t.kind,
        kind: t.kind,
        hasColourVariants: true,
        unit: "PIECE",
        quantityOnHand: 0,
        quantityReserved: 0,
        reorderPoint: 20,
        costPerUnitMinor: 0,
        active: true,
      });
      console.log("trim", t.name);
    } else {
      console.log("trim exists", t.name);
    }

    for (const c of t.colours) {
      const allCw = await db
        .select()
        .from(trimColourways)
        .where(eq(trimColourways.trimId, trimId));
      let cwId = allCw.find((x) => x.colourName === c.name)?.id;
      if (!cwId) {
        cwId = uuidv7();
        await db.insert(trimColourways).values({
          id: cwId,
          trimId,
          colourName: c.name,
          hexApproximation: c.hex,
          active: true,
        });
      }
      const stockRows = await db
        .select()
        .from(trimStock)
        .where(eq(trimStock.trimId, trimId));
      const hasStock = stockRows.some((s) => s.trimColourwayId === cwId);
      if (!hasStock) {
        await db.insert(trimStock).values({
          id: uuidv7(),
          trimId,
          trimColourwayId: cwId,
          quantityOnHand: c.onHand,
          quantityReserved: 0,
          reorderPoint: 20,
        });
      }
    }
  }

  // Sample RTW stock: first published designs with colourways × sizes S/M/L
  const designRows = await db
    .select({ id: designs.id, name: designs.name, status: designs.status })
    .from(designs)
    .limit(20);

  const published = designRows.filter((d) => d.status === "PUBLISHED");
  const targets = (published.length > 0 ? published : designRows).slice(0, 4);
  const sizes = ["S", "M", "L"] as const;
  const qtyBySize: Record<(typeof sizes)[number], number> = {
    S: 4,
    M: 8,
    L: 2,
  };

  for (const d of targets) {
    const cws = await db
      .select({ id: colourways.id, name: colourways.name })
      .from(colourways)
      .where(eq(colourways.designId, d.id))
      .limit(6);
    if (cws.length === 0) {
      console.log("skip RTW (no colourways)", d.name);
      continue;
    }
    for (const cw of cws.slice(0, 2)) {
      for (const size of sizes) {
        const existing = await db
          .select({ id: rtwStock.id })
          .from(rtwStock)
          .where(
            and(
              eq(rtwStock.designId, d.id),
              eq(rtwStock.colourwayId, cw.id),
              eq(rtwStock.sizeLabel, size),
            ),
          )
          .limit(1);
        if (existing[0]) continue;
        await db.insert(rtwStock).values({
          id: uuidv7(),
          designId: d.id,
          colourwayId: cw.id,
          sizeLabel: size,
          quantityOnHand: qtyBySize[size],
          quantityReserved: size === "M" ? 1 : 0,
          reorderPoint: 2,
        });
      }
    }
    console.log("rtw stock", d.name, cws.slice(0, 2).map((c) => c.name).join(", "));
  }

  console.log("Done. Open /admin/inventory");
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
