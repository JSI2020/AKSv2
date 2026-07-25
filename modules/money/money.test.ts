import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  db,
  permissions,
  rolePermissions,
  sql,
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
import { PermissionDeniedError, resolvePermissions } from "@/modules/auth";
import { getDesignCostingData } from "@/modules/money/queries";
import { ensureMoneySchema } from "@/modules/money/test-setup";

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

describe("money permissions", () => {
  beforeAll(async () => {
    await seedPermissions();
    await ensureMoneySchema();
  });

  beforeEach(() => {
    authMock.mockReset();
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("ACCOUNTANT has money.view and money.view_margin", () => {
    const granted = resolvePermissions({ role: "ACCOUNTANT" });
    expect(granted.has("money.view")).toBe(true);
    expect(granted.has("money.view_margin")).toBe(true);
  });

  it("STAFF cannot access design costing", () => {
    const granted = resolvePermissions({ role: "STAFF" });
    expect(granted.has("money.view")).toBe(false);
    expect(granted.has("money.view_margin")).toBe(false);
  });

  it("getDesignCostingData rejects STAFF", async () => {
    const staffId = uuidv7();
    await db.insert(users).values({
      id: staffId,
      email: `staff-money-${staffId.slice(0, 8)}@example.com`,
      name: "Staff",
      role: "STAFF",
      status: "ACTIVE",
      emailVerified: new Date(),
    });

    authMock.mockResolvedValue({
      user: { id: staffId, role: "STAFF", email: "staff@test.com" },
      expires: new Date(Date.now() + 3600_000).toISOString(),
    });

    await expect(getDesignCostingData(uuidv7())).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );

    await db.delete(users).where(eq(users.id, staffId));
  });
});
