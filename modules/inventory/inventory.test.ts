import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  colourways,
  db,
  designs,
  fabricLots,
  fabricReservations,
  fabrics,
  fitProfiles,
  garmentCategories,
  orderEvents,
  orderItems,
  orders,
  outbox,
  sizeBlocks,
  sql,
  stockAdjustments,
  users,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  allocateFabric,
  consumeFabricAtCutting,
  FabricAllocationError,
  FabricStockError,
  lotAvailableMeters,
  releaseFabricForOrder,
  reserveFabricForOrder,
} from "@/modules/inventory";
import { ensureDesignSchemaForTests, ensureInventorySchema } from "@/modules/inventory/test-setup";
import { cancelOrder } from "@/modules/orders/cancel-order";
import { generateOrderNumber } from "@/modules/orders/order-number";
import { transitionOrder } from "@/modules/orders/transition-order";
import { ensureOrdersSchema } from "@/modules/orders/test-setup";

import "@/modules/orders/transitions";

const ACTOR = { id: "01900001-2345-7890-abcd-ef123456789d", role: "OWNER" };

const SHIPPING_SNAPSHOT = {
  recipientName: "Test Customer",
  phone: "+923001234567",
  whatsappNumber: "+923001234567",
  addressLine1: "12 Mall Road",
  addressLine2: null,
  city: "Lahore",
  province: "PUNJAB" as const,
  postalCode: null,
  landmark: null,
};

async function seedFixture() {
  const cats = await db
    .select({ id: garmentCategories.id })
    .from(garmentCategories)
    .where(eq(garmentCategories.key, "KAMEEZ"))
    .limit(1);
  const categoryId = cats[0]?.id;
  if (!categoryId) throw new Error("KAMEEZ category missing — run db:seed");

  const blocks = await db
    .select({ id: sizeBlocks.id })
    .from(sizeBlocks)
    .where(
      and(
        eq(sizeBlocks.categoryId, categoryId),
        eq(sizeBlocks.isDefault, true),
      ),
    )
    .limit(1);
  const sizeBlockId = blocks[0]?.id;
  if (!sizeBlockId) throw new Error("KAMEEZ size block missing — run db:seed");

  const fitProfileId = uuidv7();
  await db.insert(fitProfiles).values({
    id: fitProfileId,
    name: "inventory-test-regular",
    categoryId,
    easeByMeasurement: { WAIST: 100, LENGTH: 0 },
    isDefault: false,
    active: true,
  });

  const fabricId = uuidv7();
  await db.insert(fabrics).values({
    id: fabricId,
    name: "inventory test lawn",
    composition: "100% cotton",
    widthInches: 5400,
    stretchPercent: 0,
    shrinkageAllowance: 50,
    reorderPointMeters: 500_00,
    reorderQuantityMeters: 1000_00,
    active: true,
  });

  const designId = uuidv7();
  await db.insert(designs).values({
    id: designId,
    slug: `inv-design-${designId}`,
    name: "Inventory Test Kameez",
    status: "PUBLISHED",
    garmentTypeId: categoryId,
    sizeBlockId,
    fitProfileIds: { KAMEEZ: fitProfileId },
    components: ["KAMEEZ"],
    basePriceMinor: 50_000_00,
    madeToMeasureSurchargeMinor: 5_000_00,
    fabricConsumptionMeters: 350_00,
    publishedAt: new Date(),
  });

  const colourwayId = uuidv7();
  await db.insert(colourways).values({
    id: colourwayId,
    designId,
    name: "Sky",
    slug: "sky",
    fabricId,
    active: true,
  });

  return { fabricId, designId, colourwayId };
}

async function ensureTestActor() {
  await db
    .insert(users)
    .values({
      id: ACTOR.id,
      email: `inventory-test-${ACTOR.id.slice(0, 8)}@example.com`,
      name: "Inventory Test Actor",
      role: "OWNER",
      status: "ACTIVE",
    })
    .onConflictDoNothing();
}

async function insertStubOrderItem(input: {
  designId: string;
  colourwayId: string;
}) {
  const orderId = uuidv7();
  const orderItemId = uuidv7();
  const orderNumber = await db.transaction((tx) => generateOrderNumber(tx));

  await db.insert(orders).values({
    id: orderId,
    orderNumber,
    whatsappNumber: "+923001234567",
    status: "DRAFT",
    subtotalMinor: 50_000_00,
    totalMinor: 50_000_00,
    depositAmountMinor: 50_000_00,
    balanceAmountMinor: 0,
    paymentPlan: "FULL_PREPAID",
    shippingAddressSnapshot: SHIPPING_SNAPSHOT,
  });

  await db.insert(orderItems).values({
    id: orderItemId,
    orderId,
    designId: input.designId,
    colourwayId: input.colourwayId,
    designSnapshot: { name: "Stub", slug: "stub" },
    sizeMode: "STANDARD",
    sizeLabel: "M",
    measurementSnapshot: {
      sessionId: "standard:M",
      values: { WAIST: 3200 },
    },
    customizationSnapshot: {},
    priceBreakdownSnapshot: {
      basePriceMinor: 50_000_00,
      colourwayDeltaMinor: 0,
      customizationDeltaMinor: 0,
      madeToMeasureSurchargeMinor: 0,
      unitPriceMinor: 50_000_00,
    },
    unitPriceMinor: 50_000_00,
    quantity: 1,
    lineTotalMinor: 50_000_00,
  });

  return orderItemId;
}

async function insertLot(input: {
  fabricId: string;
  lotCode: string;
  metersOnHand: number;
  receivedAt: Date;
}) {
  const lotId = uuidv7();
  await db.insert(fabricLots).values({
    id: lotId,
    fabricId: input.fabricId,
    lotCode: input.lotCode,
    metersReceived: input.metersOnHand,
    metersOnHand: input.metersOnHand,
    metersReserved: 0,
    receivedAt: input.receivedAt,
    status: "AVAILABLE",
  });
  return lotId;
}

async function insertOrder(input: {
  designId: string;
  colourwayId: string;
  status?: "DEPOSIT_PAID" | "MEASUREMENTS_CONFIRMED";
}) {
  const orderId = uuidv7();
  const orderItemId = uuidv7();
  const orderNumber = await db.transaction((tx) => generateOrderNumber(tx));

  await db.insert(orders).values({
    id: orderId,
    orderNumber,
    whatsappNumber: "+923001234567",
    status: input.status ?? "DEPOSIT_PAID",
    subtotalMinor: 50_000_00,
    totalMinor: 50_000_00,
    depositAmountMinor: 50_000_00,
    balanceAmountMinor: 0,
    paymentPlan: "FULL_PREPAID",
    shippingAddressSnapshot: SHIPPING_SNAPSHOT,
    placedAt: new Date(),
  });

  await db.insert(orderItems).values({
    id: orderItemId,
    orderId,
    designId: input.designId,
    colourwayId: input.colourwayId,
    designSnapshot: { name: "Inventory Test Kameez", slug: "inv-test" },
    sizeMode: "STANDARD",
    sizeLabel: "M",
    measurementSnapshot: {
      sessionId: "standard:M",
      values: { WAIST: 3200, LENGTH: 4200, HIP: 3600 },
    },
    customizationSnapshot: {},
    priceBreakdownSnapshot: {
      basePriceMinor: 50_000_00,
      colourwayDeltaMinor: 0,
      customizationDeltaMinor: 0,
      madeToMeasureSurchargeMinor: 0,
      unitPriceMinor: 50_000_00,
    },
    cutSpecSnapshot: { WAIST: 3300, LENGTH: 3050 },
    unitPriceMinor: 50_000_00,
    quantity: 1,
    lineTotalMinor: 50_000_00,
  });

  return { orderId, orderItemId, orderNumber };
}

describe("fabric lots and stock automation", () => {
  let fixture: Awaited<ReturnType<typeof seedFixture>>;

  beforeAll(async () => {
    await ensureOrdersSchema();
    await ensureDesignSchemaForTests();
    await ensureInventorySchema();
    await ensureTestActor();
    fixture = await seedFixture();
  });

  beforeEach(async () => {
    await db.delete(stockAdjustments);
    await db.delete(fabricReservations);
    await db.delete(fabricLots);
    await db.delete(orderEvents);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(outbox);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("never splits a garment across dye lots", async () => {
    const lotA = await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "LOT-A",
      metersOnHand: 200_00,
      receivedAt: new Date("2026-01-01"),
    });
    const lotB = await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "LOT-B",
      metersOnHand: 200_00,
      receivedAt: new Date("2026-02-01"),
    });

    const orderItemId = await insertStubOrderItem({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
    });
    const result = await db.transaction((tx) =>
      allocateFabric(
        {
          fabricId: fixture.fabricId,
          metersRequired: 350_00,
          orderItemId,
        },
        tx,
      ),
    );

    expect(result.status).toBe("INSUFFICIENT");
    if (result.status === "INSUFFICIENT") {
      expect(result.shortfall).toBe(150_00);
      expect(result.candidateLotIds.sort()).toEqual([lotA, lotB].sort());
    }

    const reservations = await db.select().from(fabricReservations);
    expect(reservations).toHaveLength(0);
  });

  it("chooses the oldest viable lot (FIFO)", async () => {
    await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "NEW",
      metersOnHand: 500_00,
      receivedAt: new Date("2026-03-01"),
    });
    const oldLotId = await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "OLD",
      metersOnHand: 500_00,
      receivedAt: new Date("2026-01-01"),
    });

    const orderItemId = await insertStubOrderItem({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
    });
    const result = await db.transaction((tx) =>
      allocateFabric(
        {
          fabricId: fixture.fabricId,
          metersRequired: 350_00,
          orderItemId,
        },
        tx,
      ),
    );

    expect(result.status).toBe("RESERVED");
    if (result.status === "RESERVED") {
      expect(result.fabricLotId).toBe(oldLotId);
      expect(result.lotCode).toBe("OLD");
    }
  });

  it("prevents concurrent reservations from overselling one lot", async () => {
    await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "TIGHT",
      metersOnHand: 400_00,
      receivedAt: new Date("2026-01-01"),
    });

    const orderItemA = await insertStubOrderItem({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
    });
    const orderItemB = await insertStubOrderItem({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
    });

    const results = await Promise.allSettled([
      db.transaction((tx) =>
        allocateFabric(
          {
            fabricId: fixture.fabricId,
            metersRequired: 350_00,
            orderItemId: orderItemA,
          },
          tx,
        ),
      ),
      db.transaction((tx) =>
        allocateFabric(
          {
            fabricId: fixture.fabricId,
            metersRequired: 350_00,
            orderItemId: orderItemB,
          },
          tx,
        ),
      ),
    ]);

    const reserved = results.filter(
      (r) => r.status === "fulfilled" && r.value.status === "RESERVED",
    );
    const insufficient = results.filter(
      (r) => r.status === "fulfilled" && r.value.status === "INSUFFICIENT",
    );

    expect(reserved).toHaveLength(1);
    expect(insufficient).toHaveLength(1);

    const [lot] = await db
      .select()
      .from(fabricLots)
      .where(eq(fabricLots.lotCode, "TIGHT"));
    expect(lot?.metersReserved).toBe(350_00);
    expect(lotAvailableMeters(lot!)).toBe(50_00);
  });

  it("reserves on measurements confirmed and releases on pre-cutting cancel", async () => {
    await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "ORDER-LOT",
      metersOnHand: 800_00,
      receivedAt: new Date("2026-01-01"),
    });

    const { orderId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      status: "DEPOSIT_PAID",
    });

    await db.transaction(async (tx) => {
      await transitionOrder({
        orderId,
        from: "DEPOSIT_PAID",
        to: "MEASUREMENTS_CONFIRMED",
        actor: ACTOR,
        tx,
      });
    });

    const [reserved] = await db
      .select()
      .from(fabricReservations)
      .where(eq(fabricReservations.status, "RESERVED"));
    expect(reserved?.metersReserved).toBe(350_00);

    const [lotBeforeCancel] = await db.select().from(fabricLots);
    expect(lotBeforeCancel?.metersReserved).toBe(350_00);

    await cancelOrder({
      orderId,
      reason: "Customer changed fabric",
      actor: ACTOR,
      acknowledgeDepositForfeit: true,
    });

    const [lotAfterCancel] = await db.select().from(fabricLots);
    expect(lotAfterCancel?.metersReserved).toBe(0);
    expect(lotAvailableMeters(lotAfterCancel!)).toBe(800_00);

    const [released] = await db
      .select()
      .from(fabricReservations)
      .where(eq(fabricReservations.status, "RELEASED"));
    expect(released?.metersReserved).toBe(350_00);
  });

  it("consumes stock at cutting and records wastage adjustment", async () => {
    const lotId = await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "CUT-LOT",
      metersOnHand: 800_00,
      receivedAt: new Date("2026-01-01"),
    });

    const { orderId, orderItemId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      status: "MEASUREMENTS_CONFIRMED",
    });

    await db.transaction((tx) => reserveFabricForOrder(orderId, tx));

    await db.transaction(async (tx) => {
      await transitionOrder({
        orderId,
        from: "MEASUREMENTS_CONFIRMED",
        to: "CUTTING",
        actor: ACTOR,
        tx,
      });
      await consumeFabricAtCutting(
        {
          orderId,
          actor: ACTOR,
          actualMetersByOrderItemId: { [orderItemId]: 375_00 },
        },
        tx,
      );
    });

    const [lot] = await db.select().from(fabricLots).where(eq(fabricLots.id, lotId));
    expect(lot?.metersOnHand).toBe(425_00);
    expect(lot?.metersReserved).toBe(0);

    const [consumed] = await db
      .select()
      .from(fabricReservations)
      .where(eq(fabricReservations.status, "CONSUMED"));
    expect(consumed?.actualMetersConsumed).toBe(375_00);

    const adjustments = await db.select().from(stockAdjustments);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]?.reason).toBe("CUTTING_WASTE");
    expect(adjustments[0]?.deltaMeters).toBe(-25_00);
  });

  it("rolls back stage change and stock movement when cutting fails", async () => {
    await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "FAIL-LOT",
      metersOnHand: 800_00,
      receivedAt: new Date("2026-01-01"),
    });

    const { orderId, orderItemId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      status: "MEASUREMENTS_CONFIRMED",
    });

    await db.transaction((tx) => reserveFabricForOrder(orderId, tx));

    await expect(
      db.transaction(async (tx) => {
        await transitionOrder({
          orderId,
          from: "MEASUREMENTS_CONFIRMED",
          to: "CUTTING",
          actor: ACTOR,
          tx,
        });
        await consumeFabricAtCutting(
          {
            orderId,
            actor: ACTOR,
            actualMetersByOrderItemId: { [orderItemId]: 900_00 },
          },
          tx,
        );
      }),
    ).rejects.toBeInstanceOf(FabricStockError);

    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(order?.status).toBe("MEASUREMENTS_CONFIRMED");

    const [lot] = await db
      .select()
      .from(fabricLots)
      .where(eq(fabricLots.lotCode, "FAIL-LOT"));
    expect(lot?.metersOnHand).toBe(800_00);
    expect(lot?.metersReserved).toBe(350_00);

    const reservations = await db
      .select()
      .from(fabricReservations)
      .where(eq(fabricReservations.status, "RESERVED"));
    expect(reservations).toHaveLength(1);
  });

  it("throws when confirming measurements with insufficient fabric", async () => {
    await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "SMALL",
      metersOnHand: 100_00,
      receivedAt: new Date("2026-01-01"),
    });

    const { orderId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      status: "DEPOSIT_PAID",
    });

    await expect(
      db.transaction(async (tx) => {
        await transitionOrder({
          orderId,
          from: "DEPOSIT_PAID",
          to: "MEASUREMENTS_CONFIRMED",
          actor: ACTOR,
          tx,
        });
      }),
    ).rejects.toBeInstanceOf(FabricAllocationError);

    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(order?.status).toBe("DEPOSIT_PAID");
  });

  it("emits low-stock alert when available crosses reorder point", async () => {
    await db
      .update(fabrics)
      .set({ reorderPointMeters: 300_00, reorderQuantityMeters: 500_00 })
      .where(eq(fabrics.id, fixture.fabricId));

    await insertLot({
      fabricId: fixture.fabricId,
      lotCode: "LOW",
      metersOnHand: 600_00,
      receivedAt: new Date("2026-01-01"),
    });

    const { orderId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      status: "DEPOSIT_PAID",
    });

    await db.transaction(async (tx) => {
      await transitionOrder({
        orderId,
        from: "DEPOSIT_PAID",
        to: "MEASUREMENTS_CONFIRMED",
        actor: ACTOR,
        tx,
      });
    });

    const alerts = await db
      .select()
      .from(outbox)
      .where(eq(outbox.topic, "inventory.low_stock"));
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0]?.payload).toMatchObject({
      fabricId: fixture.fabricId,
      reorderPointMeters: 300_00,
    });
  });
});
