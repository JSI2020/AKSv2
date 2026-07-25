"use server";

import { and, eq, isNull, ne } from "drizzle-orm";

import {
  db,
  permissions,
  userPermissions,
  users,
} from "@aks/db";
import {
  ROLE_DEFAULT_PERMISSIONS,
  isPermissionKey,
  type PermissionKey,
  type StaffRole,
} from "@aks/shared";
import {
  listUserSessions,
  requirePermission,
} from "@/modules/auth";

import { STAFF_ROLES } from "./roles";

function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export type StaffListItem = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export async function listStaff(): Promise<StaffListItem[]> {
  await requirePermission("staff.view");

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(ne(users.role, "CUSTOMER"), isNull(users.deletedAt)));
}

export type StaffDetail = StaffListItem & {
  overrides: { key: PermissionKey; effect: "GRANT" | "DENY" }[];
  roleDefaults: PermissionKey[];
  sessions: Awaited<ReturnType<typeof listUserSessions>>;
};

export async function getStaffDetail(
  userId: string,
): Promise<StaffDetail | null> {
  await requirePermission("staff.view");

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        ne(users.role, "CUSTOMER"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user) return null;

  const overrideRows = await db
    .select({
      key: permissions.key,
      effect: userPermissions.effect,
    })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(eq(userPermissions.userId, userId));

  const overrides = overrideRows
    .filter((r) => isPermissionKey(r.key))
    .map((r) => ({
      key: r.key as PermissionKey,
      effect: r.effect as "GRANT" | "DENY",
    }));

  const roleDefaults = isStaffRole(user.role)
    ? [...ROLE_DEFAULT_PERMISSIONS[user.role]]
    : [];

  const userSessions = await listUserSessions(userId);

  return {
    ...user,
    overrides,
    roleDefaults,
    sessions: userSessions,
  };
}
