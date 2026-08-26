import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  colourways,
  db,
  designs,
  fabrics,
  fitProfiles,
  garmentCategories,
  orderEvents,
  orderItems,
  orderPayments,
  orders,
  outbox,
  permissions,
  rolePermissions,
  sizeBlockRows,
  sizeBlocks,
  sql,
  users,
} from "@aks/db";
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_BASE_SIZE_LABEL,
  parsePermissionKey,
  ROLE_DEFAULT_PERMISSIONS,
  STANDARD_SIZE_LABELS,
  uuidv7,
  type StaffRole,
} from "@aks/shared";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { computeCartLineUnitPrice } from "@/modules/cart/compute-unit-price";
import { computeDepositAmounts } from "@/modules/checkout/payment-plans";
import { placeManualOrderAction } from "./manual/actions";
import { ensureOrdersSchema } from "./test-setup";

const authMock = vi.mocked(auth);

async function seedPermissions(): Promise<void> {
  for (const key of ALL_PERMISSION_KEYS) {
    const { module, action } = parsePermissionKey(key);
    await db
      .insert(permissions)
      .values({
        id: uuidv7(),
        key,
        module,
        action,
        description: `${module} · ${action}`,
      })
      .onConflictDoNothing({ target: permissions.key });
  }

  const permRows = await db
    .select({ id: permissions.id, key: permissions.key })
    .from(permissions);
  const idByKey = new Map(permRows.map((r) => [r.key, r.id]));

  for (const role of Object.keys(ROLE_DEFAULT_PERMISSIONS) as StaffRole[]) {
    await db.delete(rolePermissions).where(eq(rolePermissions.role, role));
    for (const key of ROLE_DEFAULT_PERMISSIONS[role]) {
      const permissionId = idByKey.get(key);
      if (!permissionId) throw new Error(`missing ${key}`);
      await db.insert(rolePermissions).values({
        id: uuidv7(),
        role,
        permissionId,
      });
    }
  }
}

async function insertManager() {
  const id = uuidv7();
  await db.insert(users).values({
    id,
    email: `manager-${id}@example.com`,
    name: "Manager",
    role: "MANAGER",
    status: "ACTIVE",
    emailVerified: new Date(),
  });
  return id;
}

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
    name: `manual-order-block-${sizeBlockId}`,
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
    name: "manual-order-test-regular",
    categoryId,
    easeByMeasurement: { WAIST: 100, LENGTH: 0 },
    isDefault: false,
    active: true,
  });

  const fabricId = uuidv7();
  await db.insert(fabrics).values({
    id: fabricId,
    name: "manual-order cotton",
    composition: "100% cotton",
    widthInches: 5400,
    stretchPercent: 0,
    shrinkageAllowance: 50,
    active: true,
  });

  const designId = uuidv7();
  await db.insert(designs).values({
    id: designId,
    slug: `manual-order-${designId}`,
    name: "Manual Order Test Kameez",
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
    slug: `ivory-${colourwayId}`,
    fabricId,
    active: true,
  });

  return { designId, colourwayId, sizeLabel: "M" as const };
}

describe("manual order entry", () => {
  let managerId: string;
  let fixture: Awaited<ReturnType<typeof seedOrderFixture>>;

  beforeAll(async () => {
    await ensureOrdersSchema();
    await seedPermissions();
    managerId = await insertManager();
    fixture = await seedOrderFixture();
  });

  beforeEach(async () => {
    authMock.mockReset();
    await db.delete(orderEvents);
    await db.delete(orderPayments);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(outbox);
    await db.delete(users).where(eq(users.role, "CUSTOMER"));
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("places a WhatsApp order with deposit through the shared flow", async () => {
    authMock.mockResolvedValue({
      user: { id: managerId, role: "MANAGER" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as never);

    const price = await computeCartLineUnitPrice({
      designId: fixture.designId,
      colourwayId: fixture.colourwayId,
      sizeMode: "STANDARD",
      customizationSelections: {},
    });
    if (!price) throw new Error("fixture design unavailable");

    const { depositAmountMinor } = computeDepositAmounts({
      totalMinor: price.unitPriceMinor,
      plan: "DEPOSIT_50_COD_50",
    });

    const result = await placeManualOrderAction({
      source: "WHATSAPP",
      customer: {
        mode: "new",
        name: "Amina Khan",
        phone: "923001112233",
        whatsappNumber: "923001112233",
      },
      address: {
        recipientName: "Amina Khan",
        phone: "923001112233",
        whatsappNumber: "923001112233",
        addressLine1: "House 12, Gulberg",
        city: "Lahore",
        province: "PUNJAB",
      },
      lines: [
        {
          designId: fixture.designId,
          colourwayId: fixture.colourwayId,
          sizeMode: "STANDARD",
          sizeLabel: fixture.sizeLabel,
          measurements: {},
          customizationSelections: {},
          quantity: 1,
        },
      ],
      paymentPlan: "DEPOSIT_50_COD_50",
      deposit: {
        amountMinor: depositAmountMinor,
        provider: "BANK_TRANSFER",
        note: "HBL ref 123",
      },
      internalNotes: "WhatsApp DM sale",
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId))
      .limit(1);

    expect(order?.source).toBe("WHATSAPP");
    expect(order?.status).toBe("DEPOSIT_PAID");
    expect(order?.placedAt).toBeTruthy();

    const [item] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, result.orderId))
      .limit(1);

    expect(item?.measurementSnapshot).toBeTruthy();
    expect(item?.cutSpecSnapshot).toBeTruthy();
    expect(item?.priceBreakdownSnapshot).toBeTruthy();

    const payments = await db
      .select()
      .from(orderPayments)
      .where(eq(orderPayments.orderId, result.orderId));

    expect(payments).toHaveLength(1);
    expect(payments[0]?.provider).toBe("BANK_TRANSFER");

    const events = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.entityId, result.orderId));

    expect(events.some((e) => e.toStatus === "AWAITING_DEPOSIT")).toBe(true);
    expect(events.some((e) => e.toStatus === "DEPOSIT_PAID")).toBe(true);

    const queued = await db.select().from(outbox);
    expect(queued.some((row) => row.topic === "order.transitioned")).toBe(true);
  });

  it("denies staff without orders.create", async () => {
    const staffId = uuidv7();
    await db.insert(users).values({
      id: staffId,
      email: `staff-${staffId}@example.com`,
      name: "Staff",
      role: "STAFF",
      status: "ACTIVE",
      emailVerified: new Date(),
    });

    authMock.mockResolvedValue({
      user: { id: staffId, role: "STAFF" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    } as never);

    const result = await placeManualOrderAction({
      source: "INSTAGRAM",
      customer: {
        mode: "new",
        name: "Test",
        phone: "923009998877",
        whatsappNumber: "923009998877",
      },
      address: {
        recipientName: "Test",
        phone: "923009998877",
        whatsappNumber: "923009998877",
        addressLine1: "Street 1",
        city: "Karachi",
        province: "SINDH",
      },
      lines: [
        {
          designId: fixture.designId,
          colourwayId: fixture.colourwayId,
          sizeMode: "STANDARD",
          sizeLabel: fixture.sizeLabel,
          measurements: {},
          customizationSelections: {},
          quantity: 1,
        },
      ],
      paymentPlan: "FULL_PREPAID",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/permission/i);
  });
});
