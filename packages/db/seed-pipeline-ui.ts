/**
 * Pipeline UI demo data shaped like:
 *   AKS_Order_List_1.html · AKS_Order_Pipeline_Visual_2.html · AKS_Fabric_Pipeline_1.html
 *
 * Idempotent on AKS-PIPE-* order numbers and [pipe-demo] fabric marker.
 *
 * Run: npm run db:seed:pipeline
 * Requires: npm run db:seed (owner + categories). Designs preferred
 * (npm run db:seed:demo) so Used-in and order line items resolve.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

type PipeStatus =
  | "AWAITING_DEPOSIT"
  | "DEPOSIT_PAID"
  | "CUTTING"
  | "STITCHING"
  | "FINISHING"
  | "DELIVERED";

function pkr(rupees: number): number {
  return Math.round(rupees) * 100;
}
function metres(m: number): number {
  return Math.round(m * 100);
}
function inchesHundredths(n: number): number {
  return Math.round(n * 100);
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
function daysAgo(n: number): Date {
  return daysFromNow(-n);
}

const FABRIC_DEFS = [
  {
    name: "Silk crepe",
    composition: "Pure silk",
    drapeClass: "MEDIUM" as const,
    cost: 3200,
    reorder: 20,
    character: "Matte, fluid yet weighted; holds a clean line",
    care: "Dry clean only. Cool iron through cloth.",
    width: 44,
    stretch: 0,
    shrink: 0.25,
    gsm: 140,
    lots: [{ code: "SC-2026-01", colour: "Ivory", onHand: 42, reserved: 0 }],
  },
  {
    name: "Cotton lawn",
    composition: "100% cotton",
    drapeClass: "LIGHT" as const,
    cost: 850,
    reorder: 20,
    character:
      "Crisp when new, softens with wash. Breathable — the everyday hero fabric",
    care: "Machine wash cold, line dry, warm iron. Shrinks slightly on first wash — allowance already cut in.",
    width: 44,
    stretch: 0,
    shrink: 0.5,
    gsm: 80,
    lots: [
      { code: "LW-2026-03", colour: "Ivory", onHand: 5, reserved: 2.5 },
      { code: "LW-2026-01", colour: "Bone", onHand: 3, reserved: 0 },
    ],
  },
  {
    name: "Khaddar",
    composition: "Handloom cotton",
    drapeClass: "HEAVY" as const,
    cost: 950,
    reorder: 15,
    character: "Textured handloom body; softens with wear",
    care: "Hand wash cold. Line dry. Warm iron.",
    width: 44,
    stretch: 0,
    shrink: 0.75,
    gsm: 220,
    lots: [{ code: "KH-2026-02", colour: "Sand", onHand: 60, reserved: 4 }],
  },
  {
    name: "Chiffon",
    composition: "Polyester chiffon",
    drapeClass: "LIGHT" as const,
    cost: 1200,
    reorder: 10,
    character: "Sheer float for dupatta and overlays",
    care: "Gentle wash. Hang dry. Cool iron.",
    width: 44,
    stretch: 0,
    shrink: 0,
    gsm: 40,
    lots: [{ code: "CH-2026-01", colour: "Milk", onHand: 35, reserved: 0 }],
  },
  {
    name: "Jamawar",
    composition: "Wool-silk",
    drapeClass: "HEAVY" as const,
    cost: 6800,
    reorder: 8,
    character: "Winter weight with a quiet sheen",
    care: "Dry clean only.",
    width: 44,
    stretch: 0,
    shrink: 0.5,
    gsm: 280,
    lots: [
      { code: "JW-2026-01", colour: "Antique gold", onHand: 12, reserved: 2 },
    ],
  },
  {
    name: "Organza",
    composition: "Silk organza",
    drapeClass: "LIGHT" as const,
    cost: 2400,
    reorder: 10,
    character: "Crisp sheer for structure and volume",
    care: "Dry clean. Cool iron.",
    width: 44,
    stretch: 0,
    shrink: 0,
    gsm: 35,
    lots: [{ code: "OR-2026-01", colour: "Ivory", onHand: 28, reserved: 0 }],
  },
  {
    name: "Cotton",
    composition: "100% cotton",
    drapeClass: "MEDIUM" as const,
    cost: 650,
    reorder: 20,
    character: "Everyday midweight cotton",
    care: "Machine wash cold, line dry.",
    width: 44,
    stretch: 0,
    shrink: 0.5,
    gsm: 140,
    lots: [{ code: "CT-2026-01", colour: "Bone", onHand: 5, reserved: 1 }],
  },
  {
    name: "Velvet",
    composition: "Silk velvet",
    drapeClass: "HEAVY" as const,
    cost: 4500,
    reorder: 10,
    character: "Deep pile for occasion evenings",
    care: "Dry clean only. Steam, never iron face.",
    width: 44,
    stretch: 0,
    shrink: 0,
    gsm: 260,
    lots: [{ code: "VL-2026-01", colour: "Espresso", onHand: 18, reserved: 0 }],
  },
];

const ORDER_DEFS: Array<{
  num: string;
  customer: string;
  item: string;
  size: string;
  status: PipeStatus;
  total: number;
  depositPct: number;
  paidPct: number;
  dueInDays: number;
  source: "WEB" | "WHATSAPP" | "INSTAGRAM" | "PHONE";
  mtm?: boolean;
  completed?: boolean;
}> = [
  {
    num: "AKS-PIPE-014",
    customer: "Sana M.",
    item: "Peshwaz",
    size: "L",
    status: "STITCHING",
    total: 44000,
    depositPct: 70,
    paidPct: 70,
    dueInDays: -4,
    source: "WHATSAPP",
  },
  {
    num: "AKS-PIPE-017",
    customer: "Hina R.",
    item: "Kalidaar",
    size: "M",
    status: "CUTTING",
    total: 32000,
    depositPct: 100,
    paidPct: 100,
    dueInDays: 2,
    source: "WEB",
  },
  {
    num: "AKS-PIPE-018",
    customer: "Mariam A.",
    item: "Angrakha",
    size: "S",
    status: "FINISHING",
    total: 38000,
    depositPct: 70,
    paidPct: 70,
    dueInDays: 3,
    source: "INSTAGRAM",
  },
  {
    num: "AKS-PIPE-019",
    customer: "Ayesha K.",
    item: "Kalidaar",
    size: "M",
    status: "STITCHING",
    total: 50000,
    depositPct: 70,
    paidPct: 70,
    dueInDays: 8,
    source: "WHATSAPP",
    mtm: true,
  },
  {
    num: "AKS-PIPE-020",
    customer: "Zoya T.",
    item: "Farshi",
    size: "L",
    status: "DEPOSIT_PAID",
    total: 48000,
    depositPct: 50,
    paidPct: 50,
    dueInDays: 12,
    source: "WEB",
  },
  {
    num: "AKS-PIPE-021",
    customer: "Nida F.",
    item: "Waistcoat",
    size: "XL",
    status: "AWAITING_DEPOSIT",
    total: 26000,
    depositPct: 50,
    paidPct: 0,
    dueInDays: 15,
    source: "PHONE",
  },
  {
    num: "AKS-PIPE-011",
    customer: "Rabia S.",
    item: "Kaftan",
    size: "M",
    status: "DELIVERED",
    total: 34000,
    depositPct: 100,
    paidPct: 100,
    dueInDays: -20,
    source: "WEB",
    completed: true,
  },
];

function orderPipeline(skipEmbroidery: boolean): string[] {
  return [
    "AWAITING_DEPOSIT",
    "DEPOSIT_PAID",
    "CUTTING",
    "STITCHING",
    ...(skipEmbroidery ? [] : ["EMBROIDERY"]),
    "FINISHING",
    "QUALITY_CHECK",
    "READY_TO_SHIP",
    "DISPATCHED",
    "DELIVERED",
    "COMPLETED",
  ];
}

function nextOrderHop(
  from: string,
  target: PipeStatus,
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
  if (from === "MEASUREMENTS_CONFIRMED") return "CUTTING";
  const pipe = orderPipeline(skipEmbroidery);
  const fi = pipe.indexOf(from);
  const ti = pipe.indexOf(target);
  if (fi < 0 || ti < 0 || fi >= ti) return null;
  return pipe[fi + 1] ?? null;
}

async function main() {
  const { and, eq, like } = await import("drizzle-orm");
  const {
    colourways,
    db,
    designCosts,
    designs,
    fabricLots,
    fabrics,
    orderEvents,
    orderItems,
    orderPayments,
    orders,
    users,
  } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");

  await import("@/modules/orders/transitions");
  await import("@/modules/production/transitions");
  const { transitionOrder } = await import(
    "@/modules/orders/transition-order"
  );
  type OrderStatus = import("@/modules/orders/constants").OrderStatus;

  console.log("Seeding pipeline UI demo data…");

  const [owner] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) {
    throw new Error("No OWNER user — run npm run db:seed first");
  }
  const actor = { id: owner.id, role: "OWNER" as const };

  const oldOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(like(orders.orderNumber, "AKS-PIPE-%"));
  for (const o of oldOrders) {
    await db.delete(orderPayments).where(eq(orderPayments.orderId, o.id));
    await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
    await db.delete(orderEvents).where(eq(orderEvents.entityId, o.id));
    await db.delete(orders).where(eq(orders.id, o.id));
  }

  const fabricIdByName = new Map<string, string>();
  for (const def of FABRIC_DEFS) {
    const existing = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(
        and(
          eq(fabrics.name, def.name),
          like(fabrics.drapeNotes, "%[pipe-demo]%"),
        ),
      )
      .limit(1);

    const id = existing[0]?.id ?? uuidv7();
    fabricIdByName.set(def.name, id);

    if (existing[0]) {
      await db.delete(fabricLots).where(eq(fabricLots.fabricId, id));
      await db
        .update(fabrics)
        .set({
          composition: def.composition,
          weightGsm: def.gsm,
          widthInches: inchesHundredths(def.width),
          stretchPercent: def.stretch,
          shrinkageAllowance: inchesHundredths(def.shrink),
          drapeClass: def.drapeClass,
          costPerMeterMinor: pkr(def.cost),
          careInstructions: def.care,
          drapeNotes: `${def.character} [pipe-demo]`,
          reorderPointMeters: metres(def.reorder),
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(fabrics.id, id));
    } else {
      await db.insert(fabrics).values({
        id,
        name: def.name,
        composition: def.composition,
        weightGsm: def.gsm,
        widthInches: inchesHundredths(def.width),
        stretchPercent: def.stretch,
        shrinkageAllowance: inchesHundredths(def.shrink),
        drapeClass: def.drapeClass,
        costPerMeterMinor: pkr(def.cost),
        careInstructions: def.care,
        drapeNotes: `${def.character} [pipe-demo]`,
        reorderPointMeters: metres(def.reorder),
        active: true,
      });
    }

    for (const lot of def.lots) {
      const onHand = metres(lot.onHand);
      const reserved = metres(lot.reserved);
      const available = onHand - reserved;
      await db.insert(fabricLots).values({
        id: uuidv7(),
        fabricId: id,
        lotCode: lot.code,
        colourNotes: lot.colour,
        metersReceived: onHand + reserved,
        metersOnHand: onHand,
        metersReserved: reserved,
        costPerMeterMinor: pkr(def.cost),
        receivedAt: daysAgo(lot.code.endsWith("01") ? 90 : 40),
        status: available <= metres(def.reorder) ? "LOW" : "AVAILABLE",
      });
    }
    console.log(`fabric ${def.name}`);
  }

  const cottonLawnId = fabricIdByName.get("Cotton lawn")!;

  const published = await db
    .select({ id: designs.id, name: designs.name, slug: designs.slug })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"))
    .limit(5);

  for (const design of published) {
    const [cost] = await db
      .select({ designId: designCosts.designId })
      .from(designCosts)
      .where(eq(designCosts.designId, design.id))
      .limit(1);
    if (cost) {
      await db
        .update(designCosts)
        .set({ fabricId: cottonLawnId })
        .where(eq(designCosts.designId, design.id));
    } else {
      await db.insert(designCosts).values({
        designId: design.id,
        fabricId: cottonLawnId,
        fabricMeters: 350,
        packagingMinor: 0,
        shippingMinor: 0,
        overheadMinor: pkr(2000),
        totalCostMinor: pkr(12000),
        sellingPriceMinor: pkr(32000),
        marginPercent: 4000,
      });
    }
  }
  if (published.length) {
    console.log(
      `linked ${published.length} design_costs → Cotton lawn (Used in)`,
    );
  } else {
    console.log(
      "no published designs — Used in empty until npm run db:seed:demo",
    );
  }

  const primaryDesign = published[0];
  const [primaryColourway] = primaryDesign
    ? await db
        .select({ id: colourways.id, fabricId: colourways.fabricId })
        .from(colourways)
        .where(eq(colourways.designId, primaryDesign.id))
        .limit(1)
    : [undefined];

  if (!primaryDesign || !primaryColourway) {
    console.warn(
      "Skipping orders — need a published design+colourway (run npm run db:seed:demo)",
    );
    console.log("Fabrics seeded. Done.");
    return;
  }

  // Cutting reserves fabric from the colourway — ensure ample PIPE stock.
  await db
    .update(colourways)
    .set({ fabricId: fabricIdByName.get("Silk crepe")! })
    .where(eq(colourways.id, primaryColourway.id));
  await db.insert(fabricLots).values({
    id: uuidv7(),
    fabricId: fabricIdByName.get("Silk crepe")!,
    lotCode: `PIPE-SEED-${Date.now().toString(36).toUpperCase()}`,
    colourNotes: "Pipeline seed buffer",
    metersReceived: metres(200),
    metersOnHand: metres(200),
    metersReserved: 0,
    costPerMeterMinor: pkr(3200),
    receivedAt: daysAgo(1),
    status: "AVAILABLE",
  });
  console.log("ensured colourway fabric stock for cutting reservations");

  for (const def of ORDER_DEFS) {
    const orderId = uuidv7();
    const total = pkr(def.total);
    const deposit = Math.round((total * def.depositPct) / 100);
    const paid = Math.round((total * def.paidPct) / 100);
    const balance = Math.max(0, total - paid);
    const placedAt = daysAgo(12);
    const promised = def.completed ? daysAgo(5) : daysFromNow(def.dueInDays);
    const skipEmbroidery = true;

    await db.insert(orders).values({
      id: orderId,
      orderNumber: def.num,
      guestEmail: `${def.customer.split(" ")[0]!.toLowerCase()}@pipe.aks.local`,
      guestPhone: "03001234567",
      whatsappNumber: "03001234567",
      status: "DRAFT",
      currency: "PKR",
      subtotalMinor: total,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: total,
      depositAmountMinor: deposit,
      balanceAmountMinor: balance,
      paymentPlan:
        def.depositPct >= 100
          ? "FULL_PREPAID"
          : def.depositPct >= 70
            ? "DEPOSIT_70_COD_30"
            : "DEPOSIT_50_COD_50",
      promisedShipDate: promised,
      shippingAddressSnapshot: {
        recipientName: def.customer,
        phone: "03001234567",
        whatsappNumber: "03001234567",
        addressLine1: "House 24, Street 7, Block F",
        addressLine2: "Gulberg III",
        city: "Lahore",
        province: "PUNJAB",
        postalCode: null,
        landmark: "Near Liberty roundabout",
      },
      customerNotes: null,
      internalNotes: "pipeline UI demo",
      source: def.source,
      placedAt: null,
      skipEmbroidery,
    });

    await db.insert(orderItems).values({
      id: uuidv7(),
      orderId,
      designId: primaryDesign.id,
      colourwayId: primaryColourway.id,
      designSnapshot: {
        name: def.item,
        slug: def.item.toLowerCase().replace(/\s+/g, "-"),
        thumbnailUrl: null,
      },
      sizeMode: def.mtm ? "MADE_TO_MEASURE" : "STANDARD",
      sizeLabel: def.mtm ? null : def.size,
      measurementSnapshot: def.mtm
        ? {
            sessionId: uuidv7(),
            values: {
              Bust: inchesHundredths(36),
              Waist: inchesHundredths(30),
              Hip: inchesHundredths(39),
              Length: inchesHundredths(42),
              Sleeve: inchesHundredths(22.5),
            },
          }
        : { sessionId: uuidv7(), values: {} },
      customizationSnapshot: {
        Colour: "Ivory",
        Fabric: "silk crepe",
        Collection: "Signature",
      },
      priceBreakdownSnapshot: {
        basePriceMinor: total,
        colourwayDeltaMinor: 0,
        customizationDeltaMinor: 0,
        madeToMeasureSurchargeMinor: 0,
        unitPriceMinor: total,
      },
      cutSpecSnapshot: null,
      unitPriceMinor: total,
      quantity: 1,
      lineTotalMinor: total,
    });

    for (let step = 0; step < 24; step++) {
      const [row] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      const from = row?.status;
      if (!from) throw new Error(`missing ${def.num}`);
      if (from === def.status) break;
      const to = nextOrderHop(from, def.status, skipEmbroidery);
      if (!to) {
        throw new Error(`${def.num}: cannot advance ${from} → ${def.status}`);
      }
      await db.transaction(async (tx) => {
        await transitionOrder({
          orderId,
          from: from as OrderStatus,
          to: to as OrderStatus,
          actor,
          note:
            to === "STITCHING"
              ? "With the karigar now."
              : to === "CUTTING"
                ? "Cut begun."
                : to === "DEPOSIT_PAID"
                  ? `Deposit paid — ${def.depositPct}%`
                  : "Pipeline demo",
          tx,
        });
      });
    }

    await db
      .update(orders)
      .set({
        placedAt,
        promisedShipDate: promised,
        balanceAmountMinor: balance,
        updatedAt: def.completed ? daysAgo(2) : new Date(),
      })
      .where(eq(orders.id, orderId));

    if (paid > 0) {
      await db.insert(orderPayments).values({
        id: uuidv7(),
        orderId,
        kind: paid >= total ? "FULL" : "DEPOSIT",
        amountMinor: paid,
        provider: "BANK_TRANSFER",
        status: "SUCCEEDED",
        note: "pipeline demo payment",
        recordedById: owner.id,
      });
    }

    console.log(`order ${def.num} → ${def.status}`);
  }

  console.log("Done. Open /admin/fabrics and /admin/orders");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
