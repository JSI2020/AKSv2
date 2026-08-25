import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assets,
  customerProfiles,
  db,
  orderEvents,
  orders,
  outbox,
  payments,
  permissions,
  rolePermissions,
  users,
} from "@aks/db";
import {
  ALL_PERMISSION_KEYS,
  parsePermissionKey,
  ROLE_DEFAULT_PERMISSIONS,
  uuidv7,
  type StaffRole,
} from "@aks/shared";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { requirePermission } from "@/modules/auth";
import { ensureOrdersSchema } from "@/modules/orders/test-setup";
import "@/modules/orders/transitions";
import { createBankTransferPaymentStandalone } from "@/modules/payments/bank-transfer/create-payment";
import { applyVerifiedBankTransfer } from "@/modules/payments/bank-transfer/verify-core";
import { getCustomerCodStatus, handleDeliveryRefused } from "@/modules/payments/cod/customer-profile";
import { recordCodBalanceOnDelivery } from "@/modules/payments/cod/queries";
import { ensurePaymentsSchema } from "@/modules/payments/test-setup";

const authMock = vi.mocked(auth);

const SHIPPING_SNAPSHOT = {
  recipientName: "Bank Transfer Customer",
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

/** Test-only prefix — never wipe live catalogue/user swatches under uploads/user|anon. */
const TEST_ASSET_PREFIX = "uploads/test/bank-transfer-cod/";

async function insertAsset() {
  const id = uuidv7();
  await db.insert(assets).values({
    id,
    r2Key: `${TEST_ASSET_PREFIX}${id}`,
    mime: "image/jpeg",
    width: 100,
    height: 100,
    bytes: 1024,
    sha256: id.replace(/-/g, ""),
    kind: "IMAGE",
  });
  return id;
}

async function insertAwaitingDepositOrder(input: {
  orderNumber: string;
  depositAmountMinor: number;
  totalMinor: number;
  userId?: string | null;
  balanceAmountMinor?: number;
}) {
  const orderId = uuidv7();
  await db.insert(orders).values({
    id: orderId,
    orderNumber: input.orderNumber,
    userId: input.userId ?? null,
    whatsappNumber: "+923001234567",
    status: "AWAITING_DEPOSIT",
    subtotalMinor: input.totalMinor,
    discountMinor: 0,
    shippingMinor: 0,
    taxMinor: 0,
    totalMinor: input.totalMinor,
    depositAmountMinor: input.depositAmountMinor,
    balanceAmountMinor:
      input.balanceAmountMinor ?? input.totalMinor - input.depositAmountMinor,
    paymentPlan: "DEPOSIT_50_COD_50",
    shippingAddressSnapshot: SHIPPING_SNAPSHOT,
    source: "WEB",
    placedAt: new Date(),
  });
  return { orderId, orderNumber: input.orderNumber };
}

describe("bank transfer and COD", () => {
  beforeAll(async () => {
    await ensureOrdersSchema();
    await ensurePaymentsSchema();
    await seedPermissions();
  });

  beforeEach(async () => {
    await db.delete(outbox);
    await db.delete(payments);
    await db.delete(customerProfiles);
    await db.delete(orderEvents);
    await db.delete(orders);
    // Only this suite's receipt fixtures — never uploads/user|anon (fabric swatches).
    await db
      .delete(assets)
      .where(like(assets.r2Key, `${TEST_ASSET_PREFIX}%`));
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  it("creates bank transfer payment awaiting verification", async () => {
    const { orderNumber } = await insertAwaitingDepositOrder({
      orderNumber: "AKS-330001",
      depositAmountMinor: 500000,
      totalMinor: 1000000,
    });
    const assetId = await insertAsset();

    const { paymentId } = await createBankTransferPaymentStandalone({
      orderNumber,
      receiptAssetId: assetId,
    });

    const paymentRows = await db.select().from(payments);
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]?.id).toBe(paymentId);
    expect(paymentRows[0]?.status).toBe("AWAITING_VERIFICATION");
    expect(paymentRows[0]?.provider).toBe("BANK_TRANSFER");
    expect(paymentRows[0]?.amountMinor).toBe(500000);

    const queued = await db.select().from(outbox);
    expect(queued.some((m) => m.topic === "payment.awaiting_verification")).toBe(
      true,
    );
  });

  it("verifies bank transfer and advances order to deposit paid", async () => {
    const staffId = await insertStaffUser("ACCOUNTANT");

    const { orderId, orderNumber } = await insertAwaitingDepositOrder({
      orderNumber: "AKS-330002",
      depositAmountMinor: 350000,
      totalMinor: 500000,
    });
    const assetId = await insertAsset();
    const { paymentId } = await createBankTransferPaymentStandalone({
      orderNumber,
      receiptAssetId: assetId,
    });

    await db.transaction(async (tx) => {
      await applyVerifiedBankTransfer(
        { paymentId, verifiedById: staffId, verifiedByRole: "ACCOUNTANT" },
        tx,
      );
    });

    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));
    expect(order?.status).toBe("DEPOSIT_PAID");

    const [payment] = await db
      .select({ status: payments.status, verifiedById: payments.verifiedById })
      .from(payments)
      .where(eq(payments.id, paymentId));
    expect(payment?.status).toBe("SUCCEEDED");
    expect(payment?.verifiedById).toBe(staffId);

    const queued = await db.select().from(outbox);
    expect(queued.some((m) => m.topic === "payment.verified")).toBe(true);
  });

  it("records COD balance on delivery", async () => {
    const orderId = uuidv7();
    await db.insert(orders).values({
      id: orderId,
      orderNumber: "AKS-330003",
      whatsappNumber: "+923001234567",
      status: "DISPATCHED",
      subtotalMinor: 1000000,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: 1000000,
      depositAmountMinor: 500000,
      balanceAmountMinor: 500000,
      paymentPlan: "DEPOSIT_50_COD_50",
      shippingAddressSnapshot: SHIPPING_SNAPSHOT,
      source: "WEB",
      placedAt: new Date(),
    });

    await db.transaction(async (tx) => {
      await recordCodBalanceOnDelivery(orderId, uuidv7(), tx);
    });

    const codRows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId));
    expect(codRows).toHaveLength(1);
    expect(codRows[0]?.provider).toBe("COD");
    expect(codRows[0]?.kind).toBe("BALANCE");
    expect(codRows[0]?.amountMinor).toBe(500000);
  });

  it("disables COD after delivery refusal", async () => {
    const userId = uuidv7();
    await db.insert(users).values({
      id: userId,
      email: `customer-${userId}@example.com`,
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    await db.transaction(async (tx) => {
      await handleDeliveryRefused(userId, uuidv7(), uuidv7(), tx);
    });

    const status = await getCustomerCodStatus(userId);
    expect(status.codRefusalCount).toBe(1);
    expect(status.codDisabled).toBe(true);

    const queued = await db.select().from(outbox);
    expect(queued.some((m) => m.topic === "customer.cod_disabled")).toBe(true);
  });

  it("permission-gates bank transfer verification", async () => {
    const staffId = await insertStaffUser("STAFF");

    authMock.mockResolvedValue({
      user: { id: staffId, role: "STAFF", email: "staff@test.com" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    });

    await expect(requirePermission("money.verify_payments")).rejects.toThrow();
  });
});
