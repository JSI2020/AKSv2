/**
 * Seed 20 pipeline orders for the admin portal (idempotent on AKS-SEED20-*).
 *
 * Run: npm run db:seed:admin-orders
 * Requires: published designs (npm run db:seed:demo or launch catalogue).
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const ORDER_COUNT = 20;
const ORDER_PREFIX = "AKS-SEED20-";

type TargetStatus =
  | "AWAITING_DEPOSIT"
  | "DEPOSIT_PAID"
  | "CUTTING"
  | "STITCHING"
  | "FINISHING"
  | "QUALITY_CHECK"
  | "READY_TO_SHIP"
  | "DISPATCHED"
  | "DELIVERED"
  | "COMPLETED";

function pkr(rupees: number): number {
  return Math.round(rupees) * 100;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function orderPipeline(skipEmbroidery: boolean): TargetStatus[] {
  return [
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
}

function nextOrderHop(
  from: string,
  target: TargetStatus,
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
  const fi = pipe.indexOf(from as TargetStatus);
  const ti = pipe.indexOf(target);
  if (fi < 0 || ti < 0 || fi >= ti) return null;
  return pipe[fi + 1] ?? null;
}

const TARGET_STATUSES: TargetStatus[] = [
  "AWAITING_DEPOSIT",
  "DEPOSIT_PAID",
  "AWAITING_DEPOSIT",
  "DEPOSIT_PAID",
  "CUTTING",
  "CUTTING",
  "STITCHING",
  "STITCHING",
  "FINISHING",
  "QUALITY_CHECK",
  "READY_TO_SHIP",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED",
  "AWAITING_DEPOSIT",
  "DEPOSIT_PAID",
  "CUTTING",
  "STITCHING",
  "FINISHING",
  "DISPATCHED",
];

async function main() {
  const { and, eq, inArray, like } = await import("drizzle-orm");
  const {
    colourways,
    db,
    designs,
    fabricLots,
    orderItems,
    orderPayments,
    orders,
    users,
  } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");

  await import("@/modules/orders/transitions");
  await import("@/modules/production/transitions");
  const { transitionOrder } = await import("@/modules/orders/transition-order");
  type OrderStatus = import("@/modules/orders/constants").OrderStatus;

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) {
    throw new Error("No OWNER user — run npm run db:seed first");
  }

  const actor = { id: owner.id, role: "OWNER" as const };

  // Cutting+ transitions reserve fabric — ensure lots exist and can cover designs.
  const fabricRows = await db
    .selectDistinct({ fabricId: colourways.fabricId })
    .from(colourways)
    .innerJoin(designs, eq(colourways.designId, designs.id))
    .where(eq(designs.status, "PUBLISHED"));

  for (const { fabricId } of fabricRows) {
    const [lot] = await db
      .select({ id: fabricLots.id })
      .from(fabricLots)
      .where(eq(fabricLots.fabricId, fabricId))
      .limit(1);

    if (!lot) {
      const now = new Date();
      const meters = 500_000;
      await db.insert(fabricLots).values({
        id: uuidv7(),
        fabricId,
        lotCode: `SEED20-${fabricId.slice(0, 8)}`,
        dyeLotRef: "SEED20",
        metersReceived: meters,
        metersOnHand: meters,
        metersReserved: 0,
        costPerMeterMinor: 0,
        receivedAt: now,
        colourNotes: "Seed stock for admin orders",
        status: "AVAILABLE",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await db
        .update(fabricLots)
        .set({
          metersReceived: 500_000,
          metersOnHand: 500_000,
          metersReserved: 0,
          status: "AVAILABLE",
          updatedAt: new Date(),
        })
        .where(eq(fabricLots.fabricId, fabricId));
    }
  }
  if (fabricRows.length) {
    console.log(`fabric lots ensured for ${fabricRows.length} fabrics`);
  }

  const existing = await db
    .select({ id: orders.id })
    .from(orders)
    .where(like(orders.orderNumber, `${ORDER_PREFIX}%`));
  if (existing.length) {
    const ids = existing.map((o) => o.id);
    await db.delete(orderPayments).where(inArray(orderPayments.orderId, ids));
    await db.delete(orderItems).where(inArray(orderItems.orderId, ids));
    await db.delete(orders).where(inArray(orders.id, ids));
    console.log(`removed ${ids.length} prior ${ORDER_PREFIX} orders`);
  }

  const catalogue = await db
    .select({
      designId: designs.id,
      slug: designs.slug,
      name: designs.name,
      basePriceMinor: designs.basePriceMinor,
      colourwayId: colourways.id,
    })
    .from(designs)
    .innerJoin(
      colourways,
      and(eq(colourways.designId, designs.id), eq(colourways.isDefault, true)),
    )
    .where(eq(designs.status, "PUBLISHED"))
    .limit(ORDER_COUNT);

  if (catalogue.length === 0) {
    throw new Error(
      "No published designs — run npm run db:seed:demo or launch:2 first",
    );
  }

  const cities = [
    { city: "Lahore", province: "PUNJAB" as const },
    { city: "Karachi", province: "SINDH" as const },
    { city: "Islamabad", province: "ICT" as const },
    { city: "Peshawar", province: "KPK" as const },
    { city: "Multan", province: "PUNJAB" as const },
  ];

  const sizes = ["XS", "S", "M", "L", "XL"] as const;
  const sources = ["WEB", "WHATSAPP", "INSTAGRAM", "PHONE", "WALK_IN"] as const;

  for (let i = 0; i < ORDER_COUNT; i++) {
    const piece = catalogue[i % catalogue.length]!;
    const target = TARGET_STATUSES[i]!;
    const place = cities[i % cities.length]!;
    const orderId = uuidv7();
    const orderNumber = `${ORDER_PREFIX}${String(i + 1).padStart(2, "0")}`;
    const qty = 1;
    const unit = piece.basePriceMinor;
    const lineTotal = unit * qty;
    const shipping = pkr(350);
    const total = lineTotal + shipping;
    const plan = i % 3 === 0 ? "DEPOSIT_70_COD_30" : "DEPOSIT_50_COD_50";
    const deposit =
      plan === "DEPOSIT_70_COD_30"
        ? Math.round(total * 0.7)
        : Math.round(total * 0.5);
    const balance = total - deposit;
    const phone = `0301${String(2000000 + i).slice(0, 7)}`;
    const skipEmbroidery = true;
    const placedAt = daysAgo(ORDER_COUNT - i);

    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId: null,
      guestEmail: `seed20-guest${i + 1}@aks.local`,
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
      promisedShipDate: daysFromNow(10 + (i % 8)),
      shippingAddressSnapshot: {
        recipientName: `Seed Guest ${i + 1}`,
        phone,
        whatsappNumber: phone,
        addressLine1: `House ${20 + i}, Block ${String.fromCharCode(65 + (i % 5))}`,
        addressLine2: null,
        city: place.city,
        province: place.province,
        postalCode: null,
        landmark: "Near main road",
      },
      customerNotes: i % 4 === 0 ? "Call before delivery." : null,
      internalNotes: `Admin seed batch · ${target}`,
      source: sources[i % sources.length]!,
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
      sizeMode: "STANDARD",
      sizeLabel: sizes[i % sizes.length]!,
      measurementSnapshot: { sessionId: uuidv7(), values: {} },
      customizationSnapshot: {},
      priceBreakdownSnapshot: {
        basePriceMinor: unit,
        colourwayDeltaMinor: 0,
        customizationDeltaMinor: 0,
        madeToMeasureSurchargeMinor: 0,
        unitPriceMinor: unit,
      },
      cutSpecSnapshot: null,
      unitPriceMinor: unit,
      quantity: qty,
      lineTotalMinor: lineTotal,
    });

    for (let step = 0; step < 24; step++) {
      const [row] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      const from = row?.status;
      if (!from) throw new Error(`Order ${orderNumber} missing`);
      if (from === target) break;

      const to = nextOrderHop(from, target, skipEmbroidery);
      if (!to) {
        throw new Error(
          `Order ${orderNumber}: cannot advance ${from} → ${target}`,
        );
      }

      await db.transaction(async (tx) => {
        await transitionOrder({
          orderId,
          from: from as OrderStatus,
          to: to as OrderStatus,
          actor,
          note: "Admin seed batch",
          tx,
        });
      });
    }

    await db.update(orders).set({ placedAt }).where(eq(orders.id, orderId));

    if (target !== "AWAITING_DEPOSIT") {
      await db.insert(orderPayments).values({
        id: uuidv7(),
        orderId,
        kind: "DEPOSIT",
        amountMinor: deposit,
        provider: (["BANK_TRANSFER", "JAZZCASH", "EASYPAISA", "CASH"] as const)[
          i % 4
        ]!,
        status: "SUCCEEDED",
        note: "Seed deposit",
        recordedById: owner.id,
      });
    }

    if (
      target === "COMPLETED" ||
      target === "DELIVERED" ||
      target === "DISPATCHED"
    ) {
      await db.insert(orderPayments).values({
        id: uuidv7(),
        orderId,
        kind: "BALANCE",
        amountMinor: balance,
        provider: target === "DISPATCHED" ? "COD" : "BANK_TRANSFER",
        status: target === "DISPATCHED" ? "PENDING" : "SUCCEEDED",
        note: "Seed balance",
        recordedById: owner.id,
      });
    }

    console.log(`  ${orderNumber} → ${target} · ${piece.name} · ${sizes[i % sizes.length]}`);
  }

  console.log(`\nSeeded ${ORDER_COUNT} orders (${ORDER_PREFIX}*) — open /admin/orders`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
