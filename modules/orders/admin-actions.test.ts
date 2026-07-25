import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  db,
  orderItems,
  orderPayments,
  orders,
  permissions,
  rolePermissions,
  sql,
  users,
} from "@aks/db";
import {
  ALL_PERMISSION_KEYS,
  parsePermissionKey,
  ROLE_DEFAULT_PERMISSIONS,
  roleDefaultPermissions,
  uuidv7,
  type StaffRole,
} from "@aks/shared";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { PermissionDeniedError, requirePermission } from "@/modules/auth";
import { refundOrderAction } from "./actions";
import { ensureOrdersSchema } from "./test-setup";

const authMock = vi.mocked(auth);

const SHIPPING_SNAPSHOT = {
  recipientName: "Storefront Guest",
  phone: "+923001234567",
  whatsappNumber: "+923001234567",
  addressLine1: "12 Mall Road",
  addressLine2: null,
  city: "Lahore",
  province: "PUNJAB" as const,
  postalCode: null,
  landmark: null,
};

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

async function insertStaffUser(role: StaffRole) {
  const id = uuidv7();
  await db.insert(users).values({
    id,
    email: `${role.toLowerCase()}-${id}@example.com`,
    name: role,
    role,
    status: "ACTIVE",
    emailVerified: new Date(),
  });
  return id;
}

describe("admin order actions", () => {
  beforeAll(async () => {
    await ensureOrdersSchema();
    await seedPermissions();
  });

  beforeEach(async () => {
    authMock.mockReset();
    await db.delete(orderPayments);
    await db.delete(orderItems);
    await db.delete(orders);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("STAFF user cannot refund", async () => {
    const staffId = await insertStaffUser("STAFF");
    authMock.mockResolvedValue({
      user: { id: staffId, role: "STAFF", email: "staff@test.com" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    });

    await expect(requirePermission("orders.refund")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );

    expect(roleDefaultPermissions("STAFF").has("orders.refund")).toBe(false);
  });

  it("storefront order appears in admin list with measurement snapshot", async () => {
    const ownerId = await insertStaffUser("OWNER");
    const orderId = uuidv7();
    const orderNumber = "AKS-2026-00099";

    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      whatsappNumber: "+923001234567",
      status: "AWAITING_DEPOSIT",
      subtotalMinor: 50_000_00,
      totalMinor: 50_000_00,
      depositAmountMinor: 50_000_00,
      balanceAmountMinor: 0,
      paymentPlan: "FULL_PREPAID",
      shippingAddressSnapshot: SHIPPING_SNAPSHOT,
      source: "WEB",
      placedAt: new Date(),
    });

    const measurementSnapshot = {
      sessionId: uuidv7(),
      values: { BUST: 3600, WAIST: 3000, LENGTH: 4200 },
    };

    await db.insert(orderItems).values({
      id: uuidv7(),
      orderId,
      designId: uuidv7(),
      colourwayId: uuidv7(),
      designSnapshot: { name: "Ivory Kameez", slug: "ivory-kameez" },
      sizeMode: "STANDARD",
      sizeLabel: "M",
      measurementSnapshot,
      customizationSnapshot: { lining: "full" },
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

    const [item] = await db
      .select({ measurementSnapshot: orderItems.measurementSnapshot })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    expect(item?.measurementSnapshot).toEqual(measurementSnapshot);

    authMock.mockResolvedValue({
      user: { id: ownerId, role: "OWNER", email: "owner@test.com" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    });

    const { listOrders, getOrderDetail } = await import("./queries");
    const list = await listOrders({});
    expect(list.items.some((row) => row.orderNumber === orderNumber)).toBe(true);

    const detail = await getOrderDetail(orderId);
    expect(detail?.items[0]?.measurementSnapshot).toEqual(measurementSnapshot);
  });

  it("refund action is permission-gated on the server", async () => {
    const staffId = await insertStaffUser("STAFF");
    const orderId = uuidv7();
    await db.insert(orders).values({
      id: orderId,
      orderNumber: "AKS-2026-00100",
      whatsappNumber: "+923001234567",
      status: "REFUND_PENDING",
      subtotalMinor: 50_000_00,
      totalMinor: 50_000_00,
      depositAmountMinor: 50_000_00,
      balanceAmountMinor: 0,
      paymentPlan: "FULL_PREPAID",
      shippingAddressSnapshot: SHIPPING_SNAPSHOT,
      placedAt: new Date(),
    });

    authMock.mockResolvedValue({
      user: { id: staffId, role: "STAFF", email: "staff@test.com" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    });

    const denied = await refundOrderAction(orderId);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toContain("permission");
    }
  });
});
