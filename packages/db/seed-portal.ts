/**
 * Portal integrity seed — registered customers, fabrics, house-door tags,
 * customer-linked orders, sample expenditures. Dev/local only.
 *
 * Run: npm run db:seed:portal
 * Prefers: db:seed → db:seed:demo first.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const PORTAL_PREFIX = "portal-";
const DOORS = ["ESSENTIALS", "TAILORED", "OCCASION", "SIGNATURE"] as const;

function pkr(rupees: number): number {
  return Math.round(rupees) * 100;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PORTAL_SEED !== "1"
  ) {
    throw new Error(
      "Refusing portal seed in production. Set ALLOW_PORTAL_SEED=1 to override.",
    );
  }

  const { and, eq, isNull, sql } = await import("drizzle-orm");
  const {
    customerProfiles,
    db,
    designTags,
    designs,
    expenditures,
    fabricColourways,
    fabricLots,
    fabrics,
    orderItems,
    orders,
    payments,
    users,
  } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");

  console.log("Seeding portal integrity data…");

  const customerIds: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const email = `${PORTAL_PREFIX}customer${i}@aks.test`;
    const phone = `92300100${String(100 + i).slice(-3)}`;
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    let userId = existing?.id;
    if (!userId) {
      userId = uuidv7();
      await db.insert(users).values({
        id: userId,
        email,
        name: `Portal Customer ${i}`,
        role: "CUSTOMER",
        phone,
      });
      await db.insert(customerProfiles).values({
        userId,
        whatsappNumber: phone,
        source: "PORTAL_SEED",
        tags: ["portal-seed"],
        acceptsMarketing: i % 2 === 0,
      });
      console.log(`  customer ${email}`);
    } else {
      const [prof] = await db
        .select({ userId: customerProfiles.userId })
        .from(customerProfiles)
        .where(eq(customerProfiles.userId, userId))
        .limit(1);
      if (!prof) {
        await db.insert(customerProfiles).values({
          userId,
          whatsappNumber: phone,
          source: "PORTAL_SEED",
          tags: ["portal-seed"],
        });
      }
    }
    customerIds.push(userId);
  }

  for (let i = 1; i <= 10; i++) {
    const name = `${PORTAL_PREFIX}fabric-${i}`;
    const [existing] = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(eq(fabrics.name, name))
      .limit(1);
    if (existing) continue;

    const fabricId = uuidv7();
    await db.insert(fabrics).values({
      id: fabricId,
      name,
      composition: "Cotton silk blend",
      widthInches: 4500,
      costPerMeterMinor: pkr(1800 + i * 100),
      drapeClass: "MEDIUM",
      active: true,
      reorderPointMeters: 500,
      reorderQuantityMeters: 2000,
    });
    const cwId = uuidv7();
    await db.insert(fabricColourways).values({
      id: cwId,
      fabricId,
      colourName: `Natural ${i}`,
      hexApproximation: "#E8E0D0",
      active: true,
    });
    await db.insert(fabricLots).values({
      id: uuidv7(),
      fabricId,
      colourwayId: cwId,
      lotCode: `PORTAL-LOT-${i}`,
      metersReceived: 2500,
      metersOnHand: 2500,
      metersReserved: 0,
      costPerMeterMinor: pkr(1800 + i * 100),
      receivedAt: daysAgo(30),
    });
    console.log(`  fabric ${name}`);
  }

  const published = await db
    .select({ id: designs.id, slug: designs.slug })
    .from(designs)
    .where(eq(designs.status, "PUBLISHED"))
    .limit(200);

  if (published.length < 10) {
    console.warn(
      `  Only ${published.length} published designs — run npm run db:seed:demo.`,
    );
  }

  const tags = await db
    .select({
      designId: designTags.designId,
      value: designTags.value,
    })
    .from(designTags)
    .where(eq(designTags.kind, "FREE"));

  const tagged = new Map<string, Set<string>>();
  for (const t of tags) {
    const set = tagged.get(t.designId) ?? new Set();
    set.add(t.value.toUpperCase());
    tagged.set(t.designId, set);
  }

  const doorIds: Record<(typeof DOORS)[number], string[]> = {
    ESSENTIALS: [],
    TAILORED: [],
    OCCASION: [],
    SIGNATURE: [],
  };
  for (const d of published) {
    const set = tagged.get(d.id);
    for (const door of DOORS) {
      if (set?.has(door)) doorIds[door].push(d.id);
    }
  }

  let assignIdx = 0;
  for (const door of DOORS) {
    while (doorIds[door].length < 10 && assignIdx < published.length) {
      const d = published[assignIdx]!;
      assignIdx += 1;
      const set = tagged.get(d.id) ?? new Set();
      if (DOORS.some((x) => set.has(x))) continue;
      await db.insert(designTags).values({
        designId: d.id,
        kind: "FREE",
        value: door,
      });
      doorIds[door].push(d.id);
      console.log(`  tagged ${d.slug} → ${door}`);
    }
    console.log(`  ${door}: ${doorIds[door].length} designs`);
  }

  // Attach portal customers to guest demo/pipeline orders lacking userId
  const guestOrders = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber })
    .from(orders)
    .where(isNull(orders.userId))
    .limit(20);

  for (let i = 0; i < guestOrders.length && i < customerIds.length; i++) {
    const o = guestOrders[i]!;
    await db
      .update(orders)
      .set({ userId: customerIds[i]! })
      .where(eq(orders.id, o.id));
    console.log(`  linked ${o.orderNumber} → customer ${i + 1}`);
  }

  // Ensure each customer has at least a reference on an order when possible
  const withUser = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(sql`${orders.userId} is not null`);
  console.log(`  orders with customers: ${withUser[0]?.n ?? 0}`);

  // Create portal-owned orders from published designs + colourways
  const { colourways } = await import("@aks/db");
  for (let i = 0; i < 10; i++) {
    const orderNumber = `AKS-PORTAL-${String(i + 1).padStart(3, "0")}`;
    const [existing] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);
    if (existing) continue;

    const design = published[i % Math.max(1, published.length)];
    if (!design) {
      console.warn("  skip portal orders — no published designs");
      break;
    }
    const [cw] = await db
      .select({ id: colourways.id })
      .from(colourways)
      .where(eq(colourways.designId, design.id))
      .limit(1);
    if (!cw) {
      console.warn(`  skip order — no colourway for ${design.slug}`);
      continue;
    }

    const userId = customerIds[i]!;
    const totalMinor = pkr(32000 + i * 2000);
    const depositMinor = Math.round(totalMinor * 0.5);
    const balanceMinor = totalMinor - depositMinor;
    const orderId = uuidv7();
    const placedAt = daysAgo(18 - i);
    const phone = `92300100${String(100 + i + 1).slice(-3)}`;
    const status =
      i === 0
        ? "AWAITING_DEPOSIT"
        : i === 1
          ? "DISPATCHED"
          : i === 2
            ? "DELIVERED"
            : i >= 7
              ? "COMPLETED"
              : "STITCHING";

    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId,
      whatsappNumber: phone,
      status: status as never,
      source: "WEB",
      paymentPlan: "DEPOSIT_50_COD_50",
      subtotalMinor: totalMinor,
      totalMinor,
      depositAmountMinor: depositMinor,
      balanceAmountMinor: balanceMinor,
      currency: "PKR",
      placedAt,
      shippingAddressSnapshot: {
        recipientName: `Portal Customer ${i + 1}`,
        phone,
        whatsappNumber: phone,
        addressLine1: "Demo Street 1",
        addressLine2: null,
        city: "Lahore",
        province: "PUNJAB",
        postalCode: null,
        landmark: null,
      },
    });

    await db.insert(orderItems).values({
      id: uuidv7(),
      orderId,
      designId: design.id,
      colourwayId: cw.id,
      designSnapshot: {
        name: design.slug,
        slug: design.slug,
        thumbnailUrl: null,
      },
      sizeMode: "STANDARD",
      sizeLabel: "M",
      measurementSnapshot: { sessionId: uuidv7(), values: {} },
      customizationSnapshot: {},
      priceBreakdownSnapshot: {
        basePriceMinor: totalMinor,
        colourwayDeltaMinor: 0,
        customizationDeltaMinor: 0,
        madeToMeasureSurchargeMinor: 0,
        unitPriceMinor: totalMinor,
      },
      cutSpecSnapshot: null,
      unitPriceMinor: totalMinor,
      quantity: 1,
      lineTotalMinor: totalMinor,
    });

    if (status !== "AWAITING_DEPOSIT") {
      await db.insert(payments).values({
        id: uuidv7(),
        orderId,
        provider: i % 2 === 0 ? "BANK_TRANSFER" : "SAFEPAY",
        kind: "DEPOSIT",
        amountMinor: depositMinor,
        currency: "PKR",
        status: "SUCCEEDED",
        idempotencyKey: `portal-deposit:${orderId}`,
        createdAt: placedAt,
      });
    }
    if (status === "DELIVERED" || status === "COMPLETED") {
      await db.insert(payments).values({
        id: uuidv7(),
        orderId,
        provider: "COD",
        kind: "BALANCE",
        amountMinor: balanceMinor,
        currency: "PKR",
        status: "SUCCEEDED",
        idempotencyKey: `portal-cod:${orderId}`,
        createdAt: daysAgo(4),
      });
    }
    console.log(`  order ${orderNumber} → ${status}`);
  }

  const sampleExp = [
    { payee: "Landlord — studio", category: "RENT" as const, amount: 45000, recurring: true, days: 40 },
    { payee: "Hosting", category: "SOFTWARE" as const, amount: 8000, recurring: true, days: 40 },
    { payee: "Domain", category: "SOFTWARE" as const, amount: 3500, recurring: true, days: 40 },
    { payee: "Karigar wages", category: "SALARIES" as const, amount: 60000, recurring: true, days: 35 },
    { payee: "Instagram ads", category: "MARKETING" as const, amount: 15000, recurring: false, days: 8 },
    { payee: "Overlock machine", category: "EQUIPMENT" as const, amount: 38000, recurring: false, days: 10 },
  ];

  for (const e of sampleExp) {
    const [hit] = await db
      .select({ id: expenditures.id })
      .from(expenditures)
      .where(
        and(
          eq(expenditures.payee, e.payee),
          eq(expenditures.note, "portal-seed"),
        ),
      )
      .limit(1);
    if (hit) continue;
    try {
      await db.insert(expenditures).values({
        id: uuidv7(),
        date: daysAgo(e.days),
        category: e.category,
        payee: e.payee,
        amountMinor: pkr(e.amount),
        paymentMethod: e.recurring ? "BANK_TRANSFER" : "CARD",
        isRecurring: e.recurring,
        recurrenceCycle: e.recurring ? "MONTHLY" : null,
        note: "portal-seed",
      });
      console.log(`  expense ${e.payee}`);
    } catch (err) {
      console.warn(
        `  skip expense ${e.payee} — run npm run db:ensure:finance first`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log("Portal seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
