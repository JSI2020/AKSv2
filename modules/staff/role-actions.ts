"use server";

import { and, eq } from "drizzle-orm";

import {
  db,
  permissions,
  rolePermissions,
  insertAuditLog,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import {
  isPermissionKey,
  type PermissionKey,
  type StaffRole,
} from "@aks/shared";
import {
  permissionIdsByKeys,
  requirePermission,
} from "@/modules/auth";

import { EDITABLE_ROLES } from "./roles";

/** Current default permission keys granted to a role (from role_permissions). */
export async function getRolePermissionKeys(
  role: string,
): Promise<PermissionKey[]> {
  const rows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.role, role as StaffRole));
  return rows.map((r) => r.key).filter(isPermissionKey);
}

/** All editable roles → their granted permission keys, in one shot. */
export async function getAllRolePermissionKeys(): Promise<
  Record<string, PermissionKey[]>
> {
  const out: Record<string, PermissionKey[]> = {};
  for (const role of EDITABLE_ROLES) {
    out[role] = await getRolePermissionKeys(role);
  }
  return out;
}

/** Grant or revoke a single permission for a whole role. */
export async function setRolePermissionAction(
  fd: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("staff.assign_permissions");
    const role = String(fd.get("role") ?? "");
    const key = String(fd.get("key") ?? "") as PermissionKey;
    const on = String(fd.get("on") ?? "") === "true";

    if (role === "OWNER") {
      return { ok: false, error: "OWNER always has full access." };
    }
    if (!EDITABLE_ROLES.includes(role as StaffRole)) {
      return { ok: false, error: "Unknown role." };
    }
    if (!isPermissionKey(key)) {
      return { ok: false, error: "Unknown permission." };
    }

    const ids = await permissionIdsByKeys([key]);
    const permissionId = ids.get(key);
    if (!permissionId) {
      return { ok: false, error: "Unknown permission." };
    }

    if (on) {
      await db
        .insert(rolePermissions)
        .values({ id: uuidv7(), role: role as StaffRole, permissionId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(rolePermissions)
        .where(
          and(
            eq(rolePermissions.role, role as StaffRole),
            eq(rolePermissions.permissionId, permissionId),
          ),
        );
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: on ? "staff.role.grant" : "staff.role.revoke",
      entityType: "role_permission",
      entityId: `${role}:${key}`,
      before: null,
      after: { role, key, on },
    });

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update role access.",
    };
  }
}
