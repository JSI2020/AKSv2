/**
 * Demo catalogue + orders so storefront/admin look populated.
 * Idempotent: removes prior demo-* designs/orders (keeps *_events), then
 * re-inserts via the admin catalogue writer (create → checklist → publish + audit).
 *
 * Run: npm run db:seed:demo
 * (Requires npm run db:seed first for categories/fabrics/owner.)
 *
 * Storefront only shows PUBLISHED designs — the same path as /admin/designs publish.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import {
  CATALOGUE_SWATCHES,
  HOUSE_CATALOGUE_LOOKS,
} from "./house-catalogue-looks";

const DEMO_PREFIX = "demo-";

const EXTRA_SIZE_BLOCKS: {
  categoryKey: "SKIRT" | "DUPATTA";
  name: string;
  rows: {
    measurementKey: string;
    baseValue: number;
    gradeIncrement: number;
    sortOrder: number;
  }[];
}[] = [
  {
    categoryKey: "SKIRT",
    name: "SKIRT default (demo)",
    rows: [
      {
        measurementKey: "WAIST",
        baseValue: 3000,
        gradeIncrement: 200,
        sortOrder: 10,
      },
      {
        measurementKey: "HIP",
        baseValue: 3800,
        gradeIncrement: 200,
        sortOrder: 20,
      },
      {
        measurementKey: "LENGTH",
        baseValue: 3600,
        gradeIncrement: 100,
        sortOrder: 30,
      },
      {
        measurementKey: "SWEEP",
        baseValue: 4800,
        gradeIncrement: 200,
        sortOrder: 40,
      },
    ],
  },
  {
    categoryKey: "DUPATTA",
    name: "DUPATTA default (demo)",
    rows: [
      {
        measurementKey: "LENGTH",
        baseValue: 9000,
        gradeIncrement: 0,
        sortOrder: 10,
      },
      {
        measurementKey: "WIDTH",
        baseValue: 3600,
        gradeIncrement: 0,
        sortOrder: 20,
      },
    ],
  },
];

function slugify(name: string, category: string, index: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${DEMO_PREFIX}${category.toLowerCase()}-${index + 1}-${base}`;
}

function pkr(rupees: number): number {
  return Math.round(rupees) * 100;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

type DemoOrderStatus =
  | "AWAITING_DEPOSIT"
  | "DEPOSIT_PAID"
  | "CUTTING"
  | "STITCHING"
  | "EMBROIDERY"
  | "FINISHING"
  | "QUALITY_CHECK"
  | "READY_TO_SHIP"
  | "DISPATCHED"
  | "DELIVERED"
  | "COMPLETED";

function orderPipeline(skipEmbroidery: boolean): DemoOrderStatus[] {
  return [
    "AWAITING_DEPOSIT",
    "DEPOSIT_PAID",
    "CUTTING",
    "STITCHING",
    ...(skipEmbroidery ? [] : (["EMBROIDERY"] as const)),
    "FINISHING",
    "QUALITY_CHECK",
    "READY_TO_SHIP",
    "DISPATCHED",
    "DELIVERED",
    "COMPLETED",
  ];
}

/** Next legal hop toward `target`. MEASUREMENTS_CONFIRMED auto-advances to CUTTING via job creation. */
function nextOrderHop(
  from: string,
  target: DemoOrderStatus,
  skipEmbroidery: boolean,
): string | null {
  if (from === target) return null;

  const towardCutting: Record<string, string> = {
    DRAFT: "AWAITING_DEPOSIT",
    AWAITING_DEPOSIT: "DEPOSIT_PAID",
    DEPOSIT_PAID: "MEASUREMENTS_CONFIRMED",
  };

  if (from in towardCutting) {
    if (target === "AWAITING_DEPOSIT" || target === "DEPOSIT_PAID") {
      const pipe = ["DRAFT", "AWAITING_DEPOSIT", "DEPOSIT_PAID"];
      const fi = pipe.indexOf(from);
      const ti = pipe.indexOf(target);
      if (fi < 0 || ti < 0 || fi >= ti) return null;
      return pipe[fi + 1] ?? null;
    }
    return towardCutting[from] ?? null;
  }

  if (from === "MEASUREMENTS_CONFIRMED") {
    return "CUTTING";
  }

  const pipe = orderPipeline(skipEmbroidery);
  const fi = pipe.indexOf(from as DemoOrderStatus);
  const ti = pipe.indexOf(target);
  if (fi < 0 || ti < 0 || fi >= ti) return null;
  return pipe[fi + 1] ?? null;
}

async function seedDemo() {
  const { and, eq, like, inArray } = await import("drizzle-orm");
  const {
    colourways,
    designTags,
    designs,
    fabricLots,
    fabrics,
    fitProfiles,
    garmentCategories,
    orderItems,
    orderPayments,
    orders,
    sizeBlockRows,
    sizeBlocks,
    users,
    db,
  } = await import("@aks/db");
  const {
    DEFAULT_BASE_SIZE_LABEL,
    STANDARD_SIZE_LABELS,
    inches,
    uuidv7,
  } = await import("@aks/shared");

  await import("@/modules/designs/transitions");
  await import("@/modules/orders/transitions");
  await import("@/modules/production/transitions");
  const { transition } = await import("@/modules/platform/transition");
  const { DESIGN_TRANSITION_ALLOW } = await import(
    "@/modules/designs/transitions"
  );
  const { transitionOrder } = await import(
    "@/modules/orders/transition-order"
  );
  type OrderStatus = import("@/modules/orders/constants").OrderStatus;

  const categories = await db.select().from(garmentCategories);
  const categoryIdByKey = new Map(categories.map((c) => [c.key, c.id]));
  for (const key of new Set(HOUSE_CATALOGUE_LOOKS.map((l) => l.category))) {
    if (!categoryIdByKey.has(key)) {
      throw new Error(`Category ${key} missing — run npm run db:seed first`);
    }
  }

  const fabricRows = await db
    .select()
    .from(fabrics)
    .where(eq(fabrics.active, true));
  if (fabricRows.length === 0) {
    throw new Error("No fabrics — run npm run db:seed first");
  }

  const fitRows = await db
    .select()
    .from(fitProfiles)
    .where(eq(fitProfiles.active, true));
  const fitByCategory = new Map<string, string>();
  for (const f of fitRows) {
    const cat = categories.find((c) => c.id === f.categoryId);
    if (cat && !fitByCategory.has(cat.key)) fitByCategory.set(cat.key, f.id);
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER user — run npm run db:seed first");

  // --- clear previous demo (never delete *_events — append-only) ---
  const demoDesigns = await db
    .select({ id: designs.id })
    .from(designs)
    .where(like(designs.slug, `${DEMO_PREFIX}%`));
  const designIds = demoDesigns.map((d) => d.id);

  if (designIds.length) {
    const demoItems = await db
      .select({ orderId: orderItems.orderId })
      .from(orderItems)
      .where(inArray(orderItems.designId, designIds));
    const orderIds = [...new Set(demoItems.map((i) => i.orderId))];

    if (orderIds.length) {
      await db
        .delete(orderPayments)
        .where(inArray(orderPayments.orderId, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
      console.log(
        `removed ${orderIds.length} demo orders (order_events retained as orphans)`,
      );
    }

    await db.delete(designs).where(inArray(designs.id, designIds));
    console.log(`removed ${designIds.length} demo designs (cascaded tags/colourways/renders)`);
  }

  // Reset DEMO lots in place (stock_adjustments are append-only — do not delete lots)
  const existingDemoLots = await db
    .select({ id: fabricLots.id })
    .from(fabricLots)
    .where(like(fabricLots.lotCode, "DEMO-%"));
  if (existingDemoLots.length) {
    await db
      .update(fabricLots)
      .set({
        metersOnHand: 50_000,
        metersReserved: 0,
        status: "AVAILABLE",
      })
      .where(like(fabricLots.lotCode, "DEMO-%"));
    console.log(`reset ${existingDemoLots.length} DEMO fabric lots`);
  }

  const leftoverDemoOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(like(orders.orderNumber, "AKS-DEMO-%"));
  if (leftoverDemoOrders.length) {
    const leftoverIds = leftoverDemoOrders.map((o) => o.id);
    await db
      .delete(orderPayments)
      .where(inArray(orderPayments.orderId, leftoverIds));
    await db.delete(orderItems).where(inArray(orderItems.orderId, leftoverIds));
    await db.delete(orders).where(inArray(orders.id, leftoverIds));
    console.log(
      `removed ${leftoverIds.length} leftover demo orders (order_events retained)`,
    );
  }

  // --- size blocks ---
  const neededCategories = [
    ...new Set([
      ...HOUSE_CATALOGUE_LOOKS.map((l) => l.category),
      "SKIRT" as const,
    ]),
  ];
  const blockIdByCategory = new Map<string, string>();
  for (const cat of neededCategories) {
    const categoryId = categoryIdByKey.get(cat);
    if (!categoryId) {
      console.warn(`skip size block — category ${cat} missing`);
      continue;
    }
    const existing = await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.categoryId, categoryId),
          eq(sizeBlocks.isDefault, true),
          eq(sizeBlocks.active, true),
        ),
      )
      .limit(1);

    if (existing[0]) {
      blockIdByCategory.set(cat, existing[0].id);
      continue;
    }

    const seed = EXTRA_SIZE_BLOCKS.find((b) => b.categoryKey === cat);
    if (!seed) {
      console.warn(`No fallback size block seed for ${cat} — using any active`);
      continue;
    }

    const blockId = uuidv7();
    await db.insert(sizeBlocks).values({
      id: blockId,
      name: seed.name,
      categoryId,
      isDefault: true,
      ownerDesignId: null,
      sizeLabels: [...STANDARD_SIZE_LABELS],
      baseSizeLabel: DEFAULT_BASE_SIZE_LABEL,
      notes: "Demo placeholder block",
      active: true,
    });
    for (const row of seed.rows) {
      await db.insert(sizeBlockRows).values({
        id: uuidv7(),
        blockId,
        measurementKey: row.measurementKey,
        baseValue: row.baseValue,
        gradeIncrement: row.gradeIncrement,
        gradeOverrides: {},
        sortOrder: row.sortOrder,
      });
    }
    blockIdByCategory.set(cat, blockId);
    console.log(`created size block for ${cat}`);
  }

  // --- fabric lots ---
  if (existingDemoLots.length === 0) {
    for (const [i, fabric] of fabricRows.entries()) {
      // Hundredths of a metre — keep ample AVAILABLE stock for order transitions
      const meters = 50_000;
      await db.insert(fabricLots).values({
        id: uuidv7(),
        fabricId: fabric.id,
        lotCode: `DEMO-${fabric.name.toUpperCase().replace(/\s+/g, "").slice(0, 8)}-${i + 1}`,
        dyeLotRef: `DYE-${2026}${i + 1}`,
        metersReceived: meters,
        metersOnHand: meters,
        metersReserved: 0,
        costPerMeterMinor: fabric.costPerMeterMinor,
        receivedAt: daysAgo(20 - (i % 15)),
        colourNotes: i % 2 === 0 ? "Batch match confirmed" : null,
        status: "AVAILABLE",
      });
    }
    console.log(`seeded ${fabricRows.length} fabric lots`);
  }
  // Always ensure DEMO lots can satisfy reservation/cutting during order transitions
  await db
    .update(fabricLots)
    .set({ metersOnHand: 50_000, metersReserved: 0, status: "AVAILABLE" })
    .where(like(fabricLots.lotCode, "DEMO-%"));

  type SeededPiece = {
    designId: string;
    colourwayId: string;
    slug: string;
    name: string;
    priceMinor: number;
  };
  const seeded: SeededPiece[] = [];

  const {
    createPublishedCatalogueDesign,
    ensureCataloguePlaceholderAsset,
  } = await import("@/modules/designs/catalogue-writer");

  // Ensure every catalogue category has a fit profile (publish checklist).
  for (const cat of neededCategories) {
    if (fitByCategory.has(cat)) continue;
    const categoryId = categoryIdByKey.get(cat);
    if (!categoryId) continue;
    const fitId = uuidv7();
    await db.insert(fitProfiles).values({
      id: fitId,
      name: `${cat} demo fit`,
      categoryId,
      easeByMeasurement: {},
      active: true,
    });
    fitByCategory.set(cat, fitId);
    console.log(`created demo fit profile for ${cat}`);
  }

  const placeholderAssetId = await ensureCataloguePlaceholderAsset(owner.id);
  const actor = { id: owner.id, role: "OWNER" };

  for (const [i, look] of HOUSE_CATALOGUE_LOOKS.entries()) {
    const categoryId = categoryIdByKey.get(look.category);
    const sizeBlockId = blockIdByCategory.get(look.category);
    const fitId = fitByCategory.get(look.category);
    if (!categoryId || !sizeBlockId || !fitId) {
      throw new Error(
        `Missing category/block/fit for ${look.category} — run npm run db:seed first`,
      );
    }

    const slug = slugify(look.name, look.category, i);
    const fabric = fabricRows[i % fabricRows.length]!;
    const fabricB = fabricRows[(i + 1) % fabricRows.length]!;
    const swatch =
      CATALOGUE_SWATCHES[look.swatchIndex % CATALOGUE_SWATCHES.length]!;
    const altSwatch =
      CATALOGUE_SWATCHES[(look.swatchIndex + 2) % CATALOGUE_SWATCHES.length]!;

    const published = await createPublishedCatalogueDesign({
      slug,
      name: look.name,
      description: `${look.name} — made to order. Cut after you confirm size.`,
      storyCopy: look.story,
      garmentTypeId: categoryId,
      components: [look.category],
      sizeBlockId,
      fitProfileIds: { [look.category]: fitId },
      basePriceMinor: pkr(look.pricePkr),
      madeToMeasureSurchargeMinor: pkr(2500),
      fabricConsumptionMeters:
        look.category === "DUPATTA"
          ? 250
          : look.category === "GOWN"
            ? 550
            : 350,
      leadTimeDaysOverride: 18 + (i % 4),
      featured: Boolean(look.featured),
      tags: [
        { kind: "OCCASION", value: look.occasion },
        { kind: "SEASON", value: "SUMMER" },
        { kind: "WORK", value: look.work ?? "PLAIN" },
        { kind: "FREE", value: look.houseTag },
        ...(look.extraFreeTags ?? []).map((value) => ({
          kind: "FREE" as const,
          value,
        })),
      ],
      colourways: [
        {
          name: swatch.name,
          slug: swatch.slug,
          fabricId: fabric.id,
          hexApproximation: swatch.hex,
          isDefault: true,
          sortOrder: 0,
        },
        {
          name: altSwatch.name,
          slug: `${altSwatch.slug}-alt`,
          fabricId: fabricB.id,
          hexApproximation: altSwatch.hex,
          priceDeltaMinor: pkr(1200),
          isDefault: false,
          sortOrder: 1,
        },
      ],
      placeholderAssetId,
      actor,
      auditNote: `Demo catalogue — ${look.houseTag}`,
    });

    await db
      .update(designs)
      .set({ publishedAt: daysAgo(i % 20) })
      .where(eq(designs.id, published.id));

    seeded.push({
      designId: published.id,
      colourwayId: published.colourwayId,
      slug: published.slug,
      name: look.name,
      priceMinor: pkr(look.pricePkr),
    });
  }
  console.log(
    `seeded ${seeded.length} designs via admin catalogue writer (10 × 5 collections)`,
  );

  const statuses: DemoOrderStatus[] = [
    "AWAITING_DEPOSIT",
    "DEPOSIT_PAID",
    "CUTTING",
    "STITCHING",
    "FINISHING",
    "QUALITY_CHECK",
    "READY_TO_SHIP",
    "DISPATCHED",
    "DELIVERED",
    "COMPLETED",
  ];

  const cities = [
    { city: "Lahore", province: "PUNJAB" as const },
    { city: "Karachi", province: "SINDH" as const },
    { city: "Islamabad", province: "ICT" as const },
    { city: "Peshawar", province: "KPK" as const },
    { city: "Multan", province: "PUNJAB" as const },
  ];

  // reuse actor from catalogue publish

  for (let i = 0; i < statuses.length; i++) {
    const piece = seeded[i % seeded.length]!;
    const status = statuses[i]!;
    const place = cities[i % cities.length]!;
    const orderId = uuidv7();
    const qty = 1;
    const unit = piece.priceMinor;
    const lineTotal = unit * qty;
    const shipping = pkr(350);
    const total = lineTotal + shipping;
    const isMtm = i % 4 === 0;
    const plan = isMtm ? "DEPOSIT_70_COD_30" : "DEPOSIT_50_COD_50";
    const deposit =
      plan === "DEPOSIT_70_COD_30"
        ? Math.round(total * 0.7)
        : Math.round(total * 0.5);
    const balance = total - deposit;
    const orderNumber = `AKS-DEMO-${String(20260001 + i)}`;
    const placedAt = daysAgo(statuses.length - i);
    const phone = `0300${String(1000000 + i).slice(0, 7)}`;
    const skipEmbroidery = true;

    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId: null,
      guestEmail: `guest${i + 1}@demo.aks.local`,
      guestPhone: phone,
      whatsappNumber: phone,
      status: "DRAFT",
      currency: "PKR",
      subtotalMinor: lineTotal,
      discountMinor: 0,
      shippingMinor: shipping,
      taxMinor: 0,
      totalMinor: total,
      depositAmountMinor: deposit,
      balanceAmountMinor: balance,
      paymentPlan: plan,
      promisedShipDate: daysAgo(-(18 + (i % 5))),
      shippingAddressSnapshot: {
        recipientName: `Demo Guest ${i + 1}`,
        phone,
        whatsappNumber: phone,
        addressLine1: `House ${10 + i}, Street ${i + 1}`,
        addressLine2: "Block A",
        city: place.city,
        province: place.province,
        postalCode: null,
        landmark: "Near mosque",
      },
      customerNotes: i % 2 === 0 ? "Please call before delivery." : null,
      internalNotes: `Demo order · ${status}`,
      source: (["WEB", "WHATSAPP", "INSTAGRAM", "PHONE", "WALK_IN"] as const)[
        i % 5
      ]!,
      placedAt: null,
      skipEmbroidery,
    });

    await db.insert(orderItems).values({
      id: uuidv7(),
      orderId,
      designId: piece.designId,
      colourwayId: piece.colourwayId,
      designSnapshot: {
        name: piece.name,
        slug: piece.slug,
        thumbnailUrl: null,
      },
      sizeMode: isMtm ? "MADE_TO_MEASURE" : "STANDARD",
      sizeLabel: isMtm ? null : (["S", "M", "L", "XL"] as const)[i % 4]!,
      measurementSnapshot: isMtm
        ? {
            sessionId: uuidv7(),
            values: {
              BUST: inches(36),
              WAIST: inches(30),
              HIP: inches(38),
            },
          }
        : { sessionId: uuidv7(), values: {} },
      customizationSnapshot: {},
      priceBreakdownSnapshot: {
        basePriceMinor: unit,
        colourwayDeltaMinor: 0,
        customizationDeltaMinor: 0,
        madeToMeasureSurchargeMinor: isMtm ? pkr(2500) : 0,
        unitPriceMinor: unit,
      },
      cutSpecSnapshot: null,
      unitPriceMinor: unit,
      quantity: qty,
      lineTotalMinor: lineTotal,
    });

    for (let step = 0; step < 20; step++) {
      const [row] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      const from = row?.status;
      if (!from) throw new Error(`Demo order ${orderNumber} missing`);
      if (from === status) break;

      const to = nextOrderHop(from, status, skipEmbroidery);
      if (!to) {
        throw new Error(
          `Demo order ${orderNumber}: cannot advance ${from} → ${status}`,
        );
      }

      await db.transaction(async (tx) => {
        await transitionOrder({
          orderId,
          from: from as OrderStatus,
          to: to as OrderStatus,
          actor,
          note: "Demo seed",
          tx,
        });
      });
    }

    await db
      .update(orders)
      .set({ placedAt })
      .where(eq(orders.id, orderId));

    if (status !== "AWAITING_DEPOSIT") {
      await db.insert(orderPayments).values({
        id: uuidv7(),
        orderId,
        kind: "DEPOSIT",
        amountMinor: deposit,
        provider: (["BANK_TRANSFER", "JAZZCASH", "EASYPAISA", "CASH"] as const)[
          i % 4
        ]!,
        status: "SUCCEEDED",
        note: "Demo deposit",
        recordedById: owner.id,
      });
    }

    if (
      status === "COMPLETED" ||
      status === "DELIVERED" ||
      status === "DISPATCHED"
    ) {
      await db.insert(orderPayments).values({
        id: uuidv7(),
        orderId,
        kind: "BALANCE",
        amountMinor: balance,
        provider: status === "DISPATCHED" ? "COD" : "BANK_TRANSFER",
        status: status === "DISPATCHED" ? "PENDING" : "SUCCEEDED",
        note: "Demo balance",
        recordedById: owner.id,
      });
    }
  }

  console.log(`seeded ${statuses.length} demo orders`);
  console.log(
    `done — ${seeded.length} house-collection designs, ${statuses.length} demo orders`,
  );
}

seedDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
