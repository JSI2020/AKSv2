import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  auditLogs,
  db,
  permissions,
  rolePermissions,
  sql,
  userPermissions,
  users,
} from "@aks/db";
import {
  ALL_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS,
  parsePermissionKey,
  roleDefaultPermissions,
  uuidv7,
  type StaffRole,
} from "@aks/shared";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

import { deleteSomethingAction } from "./actions";
import {
  getPermissionsForUser,
  PermissionDeniedError,
  requirePermission,
  resolvePermissions,
  setUserPermissionEffect,
  UnauthenticatedError,
} from "./rbac";

const authMock = vi.mocked(auth);

async function seedCatalogue(): Promise<void> {
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

async function cleanupTestUsers(): Promise<void> {
  const fixtures = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, "%@example.com"));

  if (fixtures.length === 0) return;

  const ids = fixtures.map((u) => u.id);
  await db
    .update(auditLogs)
    .set({ actorId: null })
    .where(inArray(auditLogs.actorId, ids));
  for (const id of ids) {
    await db.delete(userPermissions).where(eq(userPermissions.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
}

describe("RBAC", () => {
  beforeAll(async () => {
    await seedCatalogue();
  });

  beforeEach(async () => {
    authMock.mockReset();
    await cleanupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestUsers();
    await sql.end({ timeout: 5 });
  });

  it("role default grants match presets (MANAGER has edit, not delete)", async () => {
    const managerId = uuidv7();
    await db.insert(users).values({
      id: managerId,
      email: `manager-${managerId.slice(0, 8)}@example.com`,
      name: "Manager",
      role: "MANAGER",
      status: "ACTIVE",
      emailVerified: new Date(),
    });

    const granted = await getPermissionsForUser(managerId);

    expect(granted.has("orders.view")).toBe(true);
    expect(granted.has("orders.create")).toBe(true);
    expect(granted.has("orders.edit")).toBe(true);
    expect(granted.has("orders.delete")).toBe(false);
    expect(granted.has("designs.delete")).toBe(false);
    expect(granted.has("money.view")).toBe(false);
    expect(granted.has("settings.edit")).toBe(false);

    const preset = roleDefaultPermissions("MANAGER");
    expect([...granted].sort()).toEqual([...preset].sort());
  });

  it("explicit DENY overrides a role grant", async () => {
    const staffId = uuidv7();
    await db.insert(users).values({
      id: staffId,
      email: `staff-${staffId.slice(0, 8)}@example.com`,
      name: "Staff",
      role: "STAFF",
      status: "ACTIVE",
      emailVerified: new Date(),
    });

    expect((await getPermissionsForUser(staffId)).has("orders.edit")).toBe(
      true,
    );

    await setUserPermissionEffect({
      userId: staffId,
      key: "orders.edit",
      effect: "DENY",
      id: uuidv7(),
    });

    const after = await getPermissionsForUser(staffId);
    expect(after.has("orders.edit")).toBe(false);
    expect(after.has("orders.view")).toBe(true);
  });

  it("explicit GRANT overrides a missing role permission", () => {
    const resolved = resolvePermissions({
      role: "MANAGER",
      overrides: [{ key: "orders.delete", effect: "GRANT" }],
    });
    expect(resolved.has("orders.delete")).toBe(true);
  });

  it("requirePermission throws when UI is bypassed (no session permission)", async () => {
    const managerId = uuidv7();
    await db.insert(users).values({
      id: managerId,
      email: `mgr-bypass-${managerId.slice(0, 8)}@example.com`,
      name: "Manager Bypass",
      role: "MANAGER",
      status: "ACTIVE",
      emailVerified: new Date(),
    });

    authMock.mockResolvedValue({
      user: {
        id: managerId,
        email: `mgr-bypass-${managerId.slice(0, 8)}@example.com`,
        role: "MANAGER",
        twoFactorEnabled: false,
        requires2faEnrolment: false,
      },
      sessionId: "test-session",
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as Awaited<ReturnType<typeof auth>>);

    await expect(requirePermission("orders.delete")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it("exit: create a MANAGER; delete server action is refused server-side", async () => {
    const managerId = uuidv7();
    await db.insert(users).values({
      id: managerId,
      email: `exit-manager-${managerId.slice(0, 8)}@example.com`,
      name: "Exit Manager",
      role: "MANAGER",
      status: "ACTIVE",
      emailVerified: new Date(),
    });

    authMock.mockResolvedValue({
      user: {
        id: managerId,
        email: `exit-manager-${managerId.slice(0, 8)}@example.com`,
        role: "MANAGER",
        twoFactorEnabled: false,
        requires2faEnrolment: false,
      },
      sessionId: "exit-session",
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as Awaited<ReturnType<typeof auth>>);

    // Direct call — as if the UI were bypassed.
    await expect(deleteSomethingAction()).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );

    authMock.mockResolvedValue(null);
    await expect(deleteSomethingAction()).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("OWNER role defaults include every catalogue key", () => {
    const owner = roleDefaultPermissions("OWNER");
    expect(owner.size).toBe(ALL_PERMISSION_KEYS.length);
    for (const key of ALL_PERMISSION_KEYS) {
      expect(owner.has(key)).toBe(true);
    }
  });

  it("ADMIN lacks settings.edit_financial", () => {
    const admin = roleDefaultPermissions("ADMIN");
    expect(admin.has("settings.edit_financial")).toBe(false);
    expect(admin.has("settings.edit")).toBe(true);
    expect(admin.has("staff.create")).toBe(true);
  });
});
