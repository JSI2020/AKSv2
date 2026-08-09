import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  colourways,
  db,
  designs,
  fabrics,
  fitProfiles,
  garmentCategories,
  orderEvents,
  orderItems,
  orders,
  outbox,
  sizeBlockRows,
  sizeBlocks,
  sql,
} from "@aks/db";
import {
  DEFAULT_BASE_SIZE_LABEL,
  STANDARD_SIZE_LABELS,
  uuidv7,
} from "@aks/shared";

import { IllegalTransitionError } from "@/modules/platform/transition";

import { cancelOrder, OrderCancelError } from "./cancel-order";
import {
  buildStandardMeasurementSnapshot,
  computeCutSpecSnapshot,
} from "./compute-cut-spec-snapshot";
import { generateOrderNumber } from "./order-number";
import { transitionOrder } from "./transition-order";
import { ensureOrdersSchema } from "./test-setup";

import "./transitions";

const ACTOR = { id: "01900001-2345-7890-abcd-ef123456789c", role: "OWNER" };

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

async function seedOrderFixture() {
  const cats = await db
    .select({ id: garmentCategories.id })
    .from(garmentCategories)
    .where(eq(garmentCategories.key, "KAMEEZ"))
    .limit(1);
  const categoryId = cats[0]?.id;
  if (!categoryId) throw new Error("KAMEEZ category missing — run db:seed");

  const sizeBlockId = uuidv7();
  await db.insert(sizeBlocks).values({
    id: sizeBlockId,
    name: `orders-test-block-${sizeBlockId}`,
    categoryId,
    isDefault: false,
    ownerDesignId: null,
    sizeLabels: [...STANDARD_SIZE_LABELS],
    baseSizeLabel: DEFAULT_BASE_SIZE_LABEL,
    active: true,
  });
  await db.insert(sizeBlockRows).values([
    {
      id: uuidv7(),
      blockId: sizeBlockId,
      measurementKey: "BUST",
      baseValue: 3600,
      gradeIncrement: 200,
      gradeOverrides: {},
      sortOrder: 0,
    },
    {
      id: uuidv7(),
      blockId: sizeBlockId,
      measurementKey: "WAIST",
      baseValue: 2800,
      gradeIncrement: 200,
      gradeOverrides: {},
      sortOrder: 1,
    },
    {
      id: uuidv7(),
      blockId: sizeBlockId,
      measurementKey: "LENGTH",
      baseValue: 3700,
      gradeIncrement: 100,
      gradeOverrides: {},
      sortOrder: 2,
    },
  ]);

  const fitProfileId = uuidv7();
  await db.insert(fitProfiles).values({
    id: fitProfileId,
    name: "test-regular",
    categoryId,
    easeByMeasurement: { WAIST: 100, LENGTH: 0 },
    isDefault: false,
    active: true,
  });

  const fabricId = uuidv7();
  await db.insert(fabrics).values({
    id: fabricId,
    name: "test cotton",
    composition: "100% cotton",
    widthInches: 5400,
    stretchPercent: 0,
    shrinkageAllowance: 50,
    active: true,
  });

  const designId = uuidv7();
  await db.insert(designs).values({
    id: designId,
    slug: `test-design-${designId}`,
    name: "Test Kameez",
    status: "PUBLISHED",
    garmentTypeId: categoryId,
    sizeBlockId,
    fitProfileIds: { KAMEEZ: fitProfileId },
    components: ["KAMEEZ"],
    basePriceMinor: 50_000_00,
    madeToMeasureSurchargeMinor: 5_000_00,
    publishedAt: new Date(),
  });

  const colourwayId = uuidv7();
  await db.insert(colourways).values({
    id: colourwayId,
    designId,
    name: "Ivory",
    slug: "ivory",
    fabricId,
    active: true,
  });

  return { designId, colourwayId, sizeBlockId, fabricId, fitProfileId };
}

async function insertOrder(input: {
  status?: "DRAFT" | "AWAITING_DEPOSIT" | "DEPOSIT_PAID" | "MEASUREMENTS_CONFIRMED";
  priceBreakdown?: {
    basePriceMinor: number;
    colourwayDeltaMinor: number;
    customizationDeltaMinor: number;
    madeToMeasureSurchargeMinor: number;
    unitPriceMinor: number;
  };
  designId: string;
  colourwayId: string;
}) {
  const orderId = uuidv7();
  const orderNumber = await db.transaction((tx) => generateOrderNumber(tx));
  const priceBreakdown = input.priceBreakdown ?? {
    basePriceMinor: 50_000_00,
    colourwayDeltaMinor: 0,
    customizationDeltaMinor: 0,
    madeToMeasureSurchargeMinor: 0,
    unitPriceMinor: 50_000_00,
  };

  await db.insert(orders).values({
    id: orderId,
    orderNumber,
    whatsappNumber: "+923001234567",
    status: input.status ?? "AWAITING_DEPOSIT",
    subtotalMinor: priceBreakdown.unitPriceMinor,
    totalMinor: priceBreakdown.unitPriceMinor,
    depositAmountMinor: priceBreakdown.unitPriceMinor,
    balanceAmountMinor: 0,
    paymentPlan: "FULL_PREPAID",
    shippingAddressSnapshot: SHIPPING_SNAPSHOT,
    placedAt: input.status === "DRAFT" ? null : new Date(),
  });

  await db.insert(orderItems).values({
    id: uuidv7(),
    orderId,
    designId: input.designId,
    colourwayId: input.colourwayId,
    designSnapshot: { name: "Test Kameez", slug: "test-kameez" },
    sizeMode: "STANDARD",
    sizeLabel: "M",
    measurementSnapshot: await buildStandardMeasurementSnapshot({
      designId: input.designId,
      sizeLabel: "M",
    }),
    customizationSnapshot: {},
    priceBreakdownSnapshot: priceBreakdown,
    cutSpecSnapshot: { WAIST: 3300, LENGTH: 3050 },
    unitPriceMinor: priceBreakdown.unitPriceMinor,
    quantity: 1,
    lineTotalMinor: priceBreakdown.unitPriceMinor,
  });

  return { orderId, orderNumber };
}

describe("order state machine", () => {
  let fixture: Awaited<ReturnType<typeof seedOrderFixture>>;

  beforeAll(async () => {
    await ensureOrdersSchema();
    fixture = await seedOrderFixture();
  });

  beforeEach(async () => {
    await db.delete(orderEvents);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(outbox);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("illegal transition throws and writes nothing", async () => {
    const { orderId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      status: "AWAITING_DEPOSIT",
    });

    await expect(
      db.transaction(async (tx) => {
        await transitionOrder({
          orderId,
          from: "AWAITING_DEPOSIT",
          to: "COMPLETED",
          actor: ACTOR,
          tx,
        });
      }),
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(order?.status).toBe("AWAITING_DEPOSIT");

    const events = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.entityId, orderId));
    expect(events).toHaveLength(0);
  });

  it("generates readable order numbers", async () => {
    const { orderNumber } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
    });

    expect(orderNumber).toMatch(/^AKS-\d{4}-\d{5}$/);
  });

  it("editing a design price does not alter an existing order snapshot", async () => {
    const originalPrice = 50_000_00;
    const { orderId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      priceBreakdown: {
        basePriceMinor: originalPrice,
        colourwayDeltaMinor: 0,
        customizationDeltaMinor: 0,
        madeToMeasureSurchargeMinor: 0,
        unitPriceMinor: originalPrice,
      },
    });

    await db
      .update(designs)
      .set({ basePriceMinor: 99_000_00, updatedAt: new Date() })
      .where(eq(designs.id, fixture.designId));

    const [item] = await db
      .select({
        unitPriceMinor: orderItems.unitPriceMinor,
        priceBreakdownSnapshot: orderItems.priceBreakdownSnapshot,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    expect(item?.unitPriceMinor).toBe(originalPrice);
    expect(item?.priceBreakdownSnapshot?.basePriceMinor).toBe(originalPrice);
    expect(item?.priceBreakdownSnapshot?.unitPriceMinor).toBe(originalPrice);
  });

  it("computes cutSpecSnapshot from standard size at placement", async () => {
    const measurementSnapshot = await buildStandardMeasurementSnapshot({
      designId: fixture.designId,
      sizeLabel: "M",
    });

    const cutSpec = await computeCutSpecSnapshot({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      sizeMode: "STANDARD",
      sizeLabel: "M",
      measurementSnapshot,
    });

    expect(cutSpec).not.toBeNull();
    expect(Object.keys(cutSpec ?? {}).length).toBeGreaterThan(0);
    for (const value of Object.values(cutSpec ?? {})) {
      expect(value % 25).toBe(0);
    }
  });

  it("pre-measurement cancellation requires a reason", async () => {
    const { orderId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      status: "DEPOSIT_PAID",
    });

    await expect(
      cancelOrder({ orderId, reason: "  ", actor: ACTOR }),
    ).rejects.toBeInstanceOf(OrderCancelError);

    await cancelOrder({
      orderId,
      reason: "Customer changed mind",
      actor: ACTOR,
    });

    const [order] = await db
      .select({
        status: orders.status,
        cancelReason: orders.cancelReason,
        cancelledAt: orders.cancelledAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId));

    expect(order?.status).toBe("CANCELLED");
    expect(order?.cancelReason).toBe("Customer changed mind");
    expect(order?.cancelledAt).not.toBeNull();
  });

  it("post-measurement cancellation requires deposit forfeit acknowledgement", async () => {
    const { orderId } = await insertOrder({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      status: "MEASUREMENTS_CONFIRMED",
    });

    await expect(
      cancelOrder({
        orderId,
        reason: "Wrong fabric chosen",
        actor: ACTOR,
      }),
    ).rejects.toBeInstanceOf(OrderCancelError);

    await cancelOrder({
      orderId,
      reason: "Wrong fabric chosen",
      actor: ACTOR,
      acknowledgeDepositForfeit: true,
    });

    const [order] = await db
      .select({ status: orders.status, cancelReason: orders.cancelReason })
      .from(orders)
      .where(eq(orders.id, orderId));

    expect(order?.status).toBe("REFUND_PENDING");
    expect(order?.cancelReason).toBe("Wrong fabric chosen");
  });
});
