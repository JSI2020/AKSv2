import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Soft-launch seed: fill RTW gaps, ensure fabric lots, refresh CMS/settings.
 * Idempotent — does not wipe existing on-hand > 0.
 * Opening RTW qty is set directly (no fabric consume) so designs without
 * Costing metres still become sellable for soft launch.
 *
 * Run: npx tsx scripts/launch-seed-soft-launch.ts
 */
async function main() {
  const { eq } = await import("drizzle-orm");
  const { STANDARD_SIZE_LABELS, uuidv7 } = await import("@aks/shared");
  const { db, designs, fabricLots, fabrics, sql } = await import("@aks/db");
  const { seedRtwStockForDesign } = await import(
    "@/modules/inventory/rtw-stock"
  );
  const { seedContentDefaults } = await import(
    "@/modules/content/seed-defaults"
  );

  console.log("\n=== Soft-launch seed: inventory + CMS ===\n");

  const fabricRows = await db
    .select()
    .from(fabrics)
    .where(eq(fabrics.active, true));

  let lotsCreated = 0;
  for (const [i, fabric] of fabricRows.entries()) {
    const [existing] = await db
      .select({ id: fabricLots.id })
      .from(fabricLots)
      .where(eq(fabricLots.fabricId, fabric.id))
      .limit(1);
    if (existing) continue;

    const lotCode = `LAUNCH-${fabric.name
      .toUpperCase()
      .replace(/\s+/g, "")
      .slice(0, 10)}-${i + 1}`;
    const meters = 50_000; // 500.00 m in hundredths
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
  console.log(`fabric lots created: ${lotsCreated}`);

  const published = await db
    .select({
      id: designs.id,
      availableSizeLabels: designs.availableSizeLabels,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"));

  let rowsCreated = 0;
  for (const d of published) {
    const labels =
      d.availableSizeLabels?.length > 0
        ? d.availableSizeLabels
        : [...STANDARD_SIZE_LABELS];
    rowsCreated += await db.transaction((tx) =>
      seedRtwStockForDesign(tx, d.id, labels),
    );
  }
  console.log(`RTW rows created: ${rowsCreated}`);

  // Opening stock for empty bins only — preserves existing quantities.
  const filled = await sql<{ id: string }[]>`
    update rtw_stock
    set quantity_on_hand = 5, updated_at = now()
    where quantity_on_hand <= 0
      and design_id in (select id from designs where status = 'PUBLISHED')
    returning id`;
  console.log(`RTW zero bins filled to qty 5: ${filled.length}`);

  await seedContentDefaults();
  console.log("CMS + site settings refreshed");

  const [counts] = await sql<
    {
      published: number;
      rtw: number;
      rtw_units: number;
      lots: number;
      pages: number;
    }[]
  >`
    select
      (select count(*)::int from designs where status = 'PUBLISHED') as published,
      (select count(*)::int from rtw_stock) as rtw,
      (select coalesce(sum(quantity_on_hand),0)::int from rtw_stock) as rtw_units,
      (select count(*)::int from fabric_lots) as lots,
      (select count(*)::int from content_pages where status = 'PUBLISHED') as pages`;
  console.log("counts:", counts);

  const [gaps] = await sql<{ published_no_rtw: number; rtw_zero: number }[]>`
    select
      (select count(*)::int from designs d
        where d.status = 'PUBLISHED'
          and not exists (select 1 from rtw_stock r where r.design_id = d.id)
      ) as published_no_rtw,
      (select count(*)::int from rtw_stock where quantity_on_hand <= 0) as rtw_zero`;
  console.log("gaps:", gaps);

  const settings = await sql<{ value: unknown }[]>`
    select value from site_settings where key = 'storefront' limit 1`;
  const value = settings[0]?.value as Record<string, unknown> | undefined;
  console.log("shipping settings:", {
    mode: value?.shippingMode,
    promise: value?.shippingPromise,
    flatMinor: value?.shippingFlatMinor,
  });

  const pages = await sql<{ slug: string; body: string }[]>`
    select slug, left(body, 90) as body from content_pages
    where slug in ('faq', 'shipping-returns')`;
  for (const p of pages) console.log(`${p.slug}: ${p.body}…`);

  const ann = await sql<{ message: string }[]>`
    select message from announcements where active order by sort_order limit 2`;
  console.log("announcements:", ann.map((a) => a.message));

  console.log("\nSoft-launch seed complete.\n");
  await sql.end({ timeout: 5 });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
