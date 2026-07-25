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
  orderItems,
  orders,
  productionJobEvents,
  productionJobs,
  qcChecks,
  reworkOrders,
  sizeBlocks,
  sql,
  users,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { ensureDesignSchemaForTests, ensureInventorySchema } from "@/modules/inventory/test-setup";
import { generateOrderNumber } from "@/modules/orders/order-number";
import { ensureOrdersSchema } from "@/modules/orders/test-setup";
import { transitionOrder } from "@/modules/orders/transition-order";

import { ProductionCuttingGateError } from "./transitions";
import { enterCuttingStage } from "./cutting";
import { transitionProductionJob } from "./transition-job";
import { ensureProductionSchema } from "./test-setup";

import "@/modules/orders/transitions";
import "./transitions";

const ACTOR = { id: "01900001-2345-7890-abcd-ef123456789e", role: "OWNER" };

const SHIPPING = {
  recipientName: "Sara Khan",
  phone: "+923001234567",
  whatsappNumber: "+923001234567",
  addressLine1: "12 Mall Road",
  addressLine2: null,
  city: "Lahore",
  province: "PUNJAB" as const,
  postalCode: null,
  landmark: null,
};

describe("production board", () => {
  let fixture: {
    orderId: string;
    itemId: string;
    lotId: string;
  };

  beforeAll(async () => {
    await ensureOrdersSchema();
    await ensureDesignSchemaForTests();
    await ensureInventorySchema();
    await ensureProductionSchema();

    await db
      .insert(users)
      .values({
        id: ACTOR.id,
        email: `production-test-${ACTOR.id.slice(0, 8)}@example.com`,
        name: "Production Test",
        role: "OWNER",
        status: "ACTIVE",
      })
      .onConflictDoNothing();

    const cats = await db
      .select({ id: garmentCategories.id })
      .from(garmentCategories)
      .where(eq(garmentCategories.key, "KAMEEZ"))
      .limit(1);
    const categoryId = cats[0]?.id;
    if (!categoryId) throw new Error("KAMEEZ category missing");

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
    if (!sizeBlockId) throw new Error("size block missing");

    const fitProfileId = uuidv7();
    await db.insert(fitProfiles).values({
      id: fitProfileId,
      name: "production-test-fit",
      categoryId,
      easeByMeasurement: { WAIST: 100 },
      isDefault: false,
      active: true,
    });

    const fabricId = uuidv7();
    await db.insert(fabrics).values({
      id: fabricId,
      name: "production test lawn",
      composition: "cotton",
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
      slug: `production-design-${designId}`,
      name: "Production Test Kameez",
      status: "PUBLISHED",
      garmentTypeId: categoryId,
      sizeBlockId,
      fitProfileIds: { KAMEEZ: fitProfileId },
      components: ["KAMEEZ"],
      basePriceMinor: 50_000_00,
      fabricConsumptionMeters: 350_00,
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

    const lotId = uuidv7();
    await db.insert(fabricLots).values({
      id: lotId,
      fabricId,
      lotCode: `LOT-${lotId.slice(0, 6)}`,
      metersReceived: 1000_00,
      metersOnHand: 1000_00,
      metersReserved: 0,
      receivedAt: new Date(),
      status: "AVAILABLE",
    });

    const orderId = uuidv7();
    const itemId = uuidv7();
    const orderNumber = await db.transaction((tx) => generateOrderNumber(tx));

    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      whatsappNumber: "+923001234567",
      status: "DEPOSIT_PAID",
      subtotalMinor: 50_000_00,
      totalMinor: 50_000_00,
      depositAmountMinor: 50_000_00,
      balanceAmountMinor: 0,
      paymentPlan: "FULL_PREPAID",
      shippingAddressSnapshot: SHIPPING,
      promisedShipDate: new Date(Date.now() + 14 * 86400000),
      placedAt: new Date(),
    });

    await db.insert(orderItems).values({
      id: itemId,
      orderId,
      designId,
      colourwayId,
      designSnapshot: { name: "Production Test Kameez", slug: "production-test" },
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

    fixture = { orderId, itemId, lotId };
  });

  beforeEach(async () => {
    await db.delete(reworkOrders);
    await db.delete(qcChecks);
    await db.delete(productionJobEvents);
    await db.delete(productionJobs);
    await db.delete(fabricReservations);
    await db
      .update(fabricLots)
      .set({ metersOnHand: 1000_00, metersReserved: 0 })
      .where(eq(fabricLots.id, fixture.lotId));
    await db
      .update(orders)
      .set({ status: "DEPOSIT_PAID" })
      .where(eq(orders.id, fixture.orderId));
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("creates jobs and consumes fabric when measurements are confirmed", async () => {
    await db.transaction(async (tx) => {
      await transitionOrder({
        orderId: fixture.orderId,
        from: "DEPOSIT_PAID",
        to: "MEASUREMENTS_CONFIRMED",
        actor: ACTOR,
        tx,
      });
    });

    const jobs = await db
      .select()
      .from(productionJobs)
      .where(eq(productionJobs.orderItemId, fixture.itemId));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.stage).toBe("CUTTING");

    const [lot] = await db
      .select()
      .from(fabricLots)
      .where(eq(fabricLots.id, fixture.lotId));
    expect(lot?.metersReserved).toBe(0);
    expect(lot?.metersOnHand).toBeLessThan(1000_00);

    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, fixture.orderId));
    expect(order?.status).toBe("CUTTING");
  });

  it("refuses cutting before measurements confirmed", async () => {
    await expect(
      db.transaction(async (tx) => {
        await enterCuttingStage(fixture.orderId, ACTOR, tx);
      }),
    ).rejects.toBeInstanceOf(ProductionCuttingGateError);
  });

  it("writes production_job_events on stage transition", async () => {
    await db.transaction(async (tx) => {
      await transitionOrder({
        orderId: fixture.orderId,
        from: "DEPOSIT_PAID",
        to: "MEASUREMENTS_CONFIRMED",
        actor: ACTOR,
        tx,
      });
    });

    const [job] = await db
      .select()
      .from(productionJobs)
      .where(eq(productionJobs.orderItemId, fixture.itemId));

    await db.transaction(async (tx) => {
      await transitionProductionJob({
        jobId: job!.id,
        from: "CUTTING",
        to: "STITCHING",
        actor: ACTOR,
        tx,
      });
    });

    const events = await db
      .select()
      .from(productionJobEvents)
      .where(eq(productionJobEvents.jobId, job!.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.fromStage).toBe("CUTTING");
    expect(events[0]?.toStage).toBe("STITCHING");
  });

  it("QC fail creates rework and returns job to stitch stage", async () => {
    await db.transaction(async (tx) => {
      await transitionOrder({
        orderId: fixture.orderId,
        from: "DEPOSIT_PAID",
        to: "MEASUREMENTS_CONFIRMED",
        actor: ACTOR,
        tx,
      });
    });

    const [job] = await db
      .select()
      .from(productionJobs)
      .where(eq(productionJobs.orderItemId, fixture.itemId));

    await db
      .update(productionJobs)
      .set({ stage: "QC", status: "IN_PROGRESS" })
      .where(eq(productionJobs.id, job!.id));

    await db.transaction(async (tx) => {
      await tx.insert(qcChecks).values({
        id: uuidv7(),
        jobId: job!.id,
        orderItemId: fixture.itemId,
        checklist: { finish: "fail" },
        result: "FAIL",
        inspectorId: ACTOR.id,
      });

      await tx.insert(reworkOrders).values({
        id: uuidv7(),
        originalOrderItemId: fixture.itemId,
        originalJobId: job!.id,
        reason: "Loose hem",
        faultAttribution: "OUR_ERROR",
        costMinor: 0,
        chargeCustomer: false,
        status: "PENDING",
      });

      await transitionProductionJob({
        jobId: job!.id,
        from: "QC",
        to: "STITCHING",
        actor: ACTOR,
        note: "QC fail",
        tx,
      });
    });

    const [updated] = await db
      .select()
      .from(productionJobs)
      .where(eq(productionJobs.id, job!.id));
    expect(updated?.stage).toBe("STITCHING");

    const reworks = await db.select().from(reworkOrders);
    expect(reworks).toHaveLength(1);
    expect(reworks[0]?.chargeCustomer).toBe(false);
  });
});
