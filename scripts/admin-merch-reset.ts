/**
 * Local merch reset: wipe storefront-facing catalog/promo/content ticker rows,
 * then reseed via the same writers admin uses (catalogue-writer publish path).
 *
 * Does NOT change application code. Safe for local only.
 *
 * Run: npx tsx --env-file=.env.local scripts/admin-merch-reset.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function wipeMerch() {
  const { eq, inArray, sql } = await import("drizzle-orm");
  const {
    db,
    announcements,
    cartLines,
    carts,
    designs,
    discountRedemptions,
    discounts,
    fabricReservations,
    orderItems,
    orderPayments,
    orders,
    rtwMovements,
    rtwStock,
  } = await import("@aks/db");

  console.log("=== WIPE merch (designs, inventory RTW, discounts, announcements) ===");

  // Carts block design FK
  const lineCount = await db.delete(cartLines).returning({ id: cartLines.id });
  console.log(`cart_lines deleted: ${lineCount.length}`);

  // Orders that reference live designs (snapshots stay immutable — remove demo/local orders)
  const allOrders = await db.select({ id: orders.id }).from(orders);
  if (allOrders.length) {
    const orderIds = allOrders.map((o) => o.id);
    await db
      .delete(discountRedemptions)
      .where(inArray(discountRedemptions.orderId, orderIds));
    await db.delete(orderPayments).where(inArray(orderPayments.orderId, orderIds));
    // fabric_reservations → order_items
    const items = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));
    if (items.length) {
      await db
        .delete(fabricReservations)
        .where(inArray(fabricReservations.orderItemId, items.map((i) => i.id)));
    }
    await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.id, orderIds));
    console.log(`orders deleted: ${orderIds.length}`);
  }

  await db.delete(discountRedemptions);
  const disc = await db.delete(discounts).returning({ id: discounts.id });
  console.log(`discounts deleted: ${disc.length}`);

  const anns = await db.delete(announcements).returning({ id: announcements.id });
  console.log(`announcements deleted: ${anns.length}`);

  // RTW movements → stock → designs
  await db.delete(rtwMovements);
  const rtw = await db.delete(rtwStock).returning({ id: rtwStock.id });
  console.log(`rtw_stock deleted: ${rtw.length}`);

  const designRows = await db.select({ id: designs.id }).from(designs);
  if (designRows.length) {
    // Keep *_events (append-only); cascade children (tags, colourways, renders, studio)
    await db.delete(designs);
    console.log(`designs deleted: ${designRows.length}`);
  } else {
    console.log("designs deleted: 0");
  }

  // Abandon empty carts
  await db
    .update(carts)
    .set({ status: "ABANDONED", updatedAt: new Date() })
    .where(eq(carts.status, "ACTIVE"));

  // Sanity
  const left = await db.execute(
    sql`select
      (select count(*)::int from designs) as designs,
      (select count(*)::int from colourways) as colourways,
      (select count(*)::int from discounts) as discounts,
      (select count(*)::int from announcements) as announcements,
      (select count(*)::int from rtw_stock) as rtw`,
  );
  console.log("post-wipe counts", left);
}

async function seedPromoAndTicker() {
  const { db, announcements, discounts } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");

  console.log("=== SEED discounts + announcements (admin-shaped rows) ===");

  await db.insert(discounts).values([
    {
      id: uuidv7(),
      code: null,
      name: "Soft launch — house 10%",
      type: "PERCENTAGE",
      value: 10,
      appliesTo: "ORDER",
      targetIds: [],
      minSpendMinor: 0,
      maxDiscountMinor: null,
      firstOrderOnly: false,
      oncePerCustomer: false,
      usageLimit: null,
      usageCount: 0,
      startsAt: new Date(),
      endsAt: null,
      stackable: false,
      status: "ACTIVE",
    },
    {
      id: uuidv7(),
      code: "AKSWELCOME",
      name: "Welcome — PKR 2,000 off",
      type: "FIXED_AMOUNT",
      value: 200_000, // paisa
      appliesTo: "ORDER",
      targetIds: [],
      minSpendMinor: 1_500_000, // PKR 15,000
      maxDiscountMinor: null,
      firstOrderOnly: true,
      oncePerCustomer: true,
      usageLimit: 500,
      usageCount: 0,
      startsAt: new Date(),
      endsAt: null,
      stackable: false,
      status: "ACTIVE",
    },
  ]);
  console.log("discounts: 2 ACTIVE (auto 10% + AKSWELCOME)");

  await db.insert(announcements).values([
    {
      id: uuidv7(),
      message: "Pakistan shipping · standard house sizes XS–XL · cut to fit, not to fad",
      link: { type: "collection", value: "essentials" },
      active: true,
      sortOrder: 0,
      startsAt: null,
      endsAt: null,
    },
    {
      id: uuidv7(),
      message: "White Collection looks live — enter Signature",
      link: { type: "collection", value: "signature" },
      active: true,
      sortOrder: 1,
      startsAt: null,
      endsAt: null,
    },
  ]);
  console.log("announcements: 2 active ticker rows");
}

async function ensureContentPublished() {
  const { seedContentDefaults } = await import(
    "@/modules/content/seed-defaults"
  );
  await seedContentDefaults();
  console.log("content defaults ensured (homepage draft+published, doors, nav)");
}

async function verifyWiring() {
  const { eq, and, sql } = await import("drizzle-orm");
  const {
    db,
    designs,
    colourways,
    designTags,
    fabrics,
    discounts,
    announcements,
    heroSlides,
    categoryTiles,
    homepages,
    rtwStock,
  } = await import("@aks/db");

  const published = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      name: designs.name,
    })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"));

  let missingColourway = 0;
  let missingHouseTag = 0;
  let missingFabric = 0;

  for (const d of published.slice(0, 80)) {
    const cws = await db
      .select({
        id: colourways.id,
        fabricId: colourways.fabricId,
      })
      .from(colourways)
      .where(eq(colourways.designId, d.id));
    if (cws.length === 0) missingColourway += 1;
    for (const cw of cws) {
      if (!cw.fabricId) {
        missingFabric += 1;
        continue;
      }
      const fab = await db
        .select({ active: fabrics.active })
        .from(fabrics)
        .where(eq(fabrics.id, cw.fabricId))
        .limit(1);
      if (!fab[0]?.active) missingFabric += 1;
    }
    const tags = await db
      .select({ value: designTags.value, kind: designTags.kind })
      .from(designTags)
      .where(and(eq(designTags.designId, d.id), eq(designTags.kind, "FREE")));
    const house = tags.some((t) =>
      ["ESSENTIALS", "TAILORED", "OCCASION", "SIGNATURE", "SEPARATES"].includes(
        t.value,
      ),
    );
    if (!house) missingHouseTag += 1;
  }

  const [counts] = (
    await db.execute(sql`
      select
        (select count(*)::int from designs where status = 'PUBLISHED') as published,
        (select count(*)::int from fabrics where active) as fabrics_active,
        (select count(*)::int from discounts where status = 'ACTIVE') as discounts_active,
        (select count(*)::int from announcements where active) as announcements_active,
        (select count(*)::int from rtw_stock) as rtw,
        (select count(*)::int from fabric_lots) as lots,
        (select count(*)::int from homepages where status = 'PUBLISHED') as homepage_pub,
        (select count(*)::int from category_tiles) as tiles,
        (select count(*)::int from hero_slides) as slides,
        (select count(*)::int from nav_items where active) as nav
    `)
  ) as unknown as Array<Record<string, number>>;

  const report = {
    counts,
    wiring: {
      publishedChecked: Math.min(published.length, 80),
      missingColourway,
      missingHouseTag,
      missingFabricLinkOrInactive: missingFabric,
    },
    sampleSlugs: published.slice(0, 8).map((d) => d.slug),
  };
  console.log("=== VERIFY ===");
  console.log(JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  await wipeMerch();
  await ensureContentPublished();
  await seedPromoAndTicker();

  console.log("=== RESEED foundations check (categories/fabrics/owner) ===");
  // Re-run fabric/sizing foundations only if empty — full seed.ts re-inserts fabrics
  const { db, fabrics, garmentCategories, users } = await import("@aks/db");
  const { eq } = await import("drizzle-orm");
  const cats = await db.select({ id: garmentCategories.id }).from(garmentCategories).limit(1);
  const fabs = await db
    .select({ id: fabrics.id })
    .from(fabrics)
    .where(eq(fabrics.active, true))
    .limit(1);
  const owner = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!cats[0] || !fabs[0] || !owner[0]) {
    throw new Error(
      "Missing categories/fabrics/owner — run: npm run db:seed  then re-run this script",
    );
  }
  console.log("foundations OK");

  console.log("=== RESEED demo catalogue (admin publish path) ===");
  // Invoke seed-demo by spawning would be cleaner; import its side effects via child process
  const { spawnSync } = await import("node:child_process");
  const demo = spawnSync(
    "npx",
    ["tsx", "--env-file=.env.local", "packages/db/seed-demo.ts"],
    { cwd: process.cwd(), encoding: "utf8", shell: true },
  );
  console.log(demo.stdout);
  if (demo.status !== 0) {
    console.error(demo.stderr);
    throw new Error(`seed-demo failed: ${demo.status}`);
  }

  console.log("=== RESEED inventory ledger (RTW + packing/trims) ===");
  const inv = spawnSync(
    "npx",
    ["tsx", "--env-file=.env.local", "packages/db/seed-inventory-ledger.ts"],
    { cwd: process.cwd(), encoding: "utf8", shell: true },
  );
  console.log(inv.stdout);
  if (inv.status !== 0) {
    console.error(inv.stderr);
    throw new Error(`seed-inventory failed: ${inv.status}`);
  }

  await verifyWiring();
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
