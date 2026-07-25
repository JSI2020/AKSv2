import { eq, inArray } from "drizzle-orm";

import {
  db,
  permissions,
  rolePermissions,
  userPermissions,
  users,
} from "@aks/db";
import {
  isPermissionKey,
  type PermissionKey,
  roleDefaultPermissions,
} from "@aks/shared";

type UserRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "STAFF"
  | "TAILOR"
  | "ACCOUNTANT"
  | "READ_ONLY"
  | "CUSTOMER";

export class PermissionDeniedError extends Error {
  readonly key: string;
  readonly code = "PERMISSION_DENIED" as const;

  constructor(key: string, message?: string) {
    super(message ?? `Missing permission: ${key}`);
    this.name = "PermissionDeniedError";
    this.key = key;
  }
}

export class UnauthenticatedError extends Error {
  readonly code = "UNAUTHENTICATED" as const;

  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * Resolve effective permissions for a user:
 * role defaults (from DB role_permissions, falling back to code presets),
 * then explicit GRANT/DENY which always win.
 */
export async function getPermissionsForUser(
  userId: string,
): Promise<Set<PermissionKey>> {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return new Set();
  }

  const roleKeys = await loadRolePermissionKeys(user.role);
  const effective = new Set<PermissionKey>(roleKeys);

  const overrides = await db
    .select({
      key: permissions.key,
      effect: userPermissions.effect,
    })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(eq(userPermissions.userId, userId));

  for (const row of overrides) {
    if (!isPermissionKey(row.key)) continue;
    if (row.effect === "GRANT") {
      effective.add(row.key);
    } else if (row.effect === "DENY") {
      effective.delete(row.key);
    }
  }

  return effective;
}

async function loadRolePermissionKeys(role: string): Promise<PermissionKey[]> {
  const rows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.role, role as UserRole));

  if (rows.length > 0) {
    return rows.map((r) => r.key).filter(isPermissionKey);
  }

  // Fallback when seed has not run yet (e.g. pure unit paths).
  return [...roleDefaultPermissions(role)];
}

export async function userHasPermission(
  userId: string,
  key: PermissionKey,
): Promise<boolean> {
  const set = await getPermissionsForUser(userId);
  return set.has(key);
}

/**
 * Server-action gate. Throws if the session is missing or lacks `key`.
 * UI hiding is never a substitute for this.
 */
export async function requirePermission(key: PermissionKey) {
  // Dynamic import avoids a static cycle: auth.ts → modules/auth → rbac → auth.
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthenticatedError();
  }

  const allowed = await userHasPermission(session.user.id, key);
  if (!allowed) {
    throw new PermissionDeniedError(key);
  }

  return session;
}

/** Look up permission row ids by key (for grants/denies in tests & seed helpers). */
export async function permissionIdsByKeys(
  keys: readonly PermissionKey[],
): Promise<Map<PermissionKey, string>> {
  if (keys.length === 0) return new Map();
  const rows = await db
    .select({ id: permissions.id, key: permissions.key })
    .from(permissions)
    .where(inArray(permissions.key, [...keys]));

  const map = new Map<PermissionKey, string>();
  for (const row of rows) {
    if (isPermissionKey(row.key)) {
      map.set(row.key, row.id);
    }
  }
  return map;
}

export async function setUserPermissionEffect(params: {
  userId: string;
  key: PermissionKey;
  effect: "GRANT" | "DENY";
  id: string;
}): Promise<void> {
  const ids = await permissionIdsByKeys([params.key]);
  const permissionId = ids.get(params.key);
  if (!permissionId) {
    throw new Error(`Unknown permission key: ${params.key}`);
  }

  await db
    .insert(userPermissions)
    .values({
      id: params.id,
      userId: params.userId,
      permissionId,
      effect: params.effect,
    })
    .onConflictDoUpdate({
      target: [userPermissions.userId, userPermissions.permissionId],
      set: {
        effect: params.effect,
        updatedAt: new Date(),
      },
    });
}

/** Pure check against an already-resolved set (for UI helpers / tests). */
export function can(
  granted: ReadonlySet<string>,
  key: PermissionKey,
): boolean {
  return granted.has(key);
}

/** Resolve using in-memory role defaults + overrides (no DB). Useful in unit tests. */
export function resolvePermissions(params: {
  role: string;
  overrides?: ReadonlyArray<{ key: PermissionKey; effect: "GRANT" | "DENY" }>;
}): Set<PermissionKey> {
  const effective = new Set(roleDefaultPermissions(params.role));
  for (const o of params.overrides ?? []) {
    if (o.effect === "GRANT") effective.add(o.key);
    else effective.delete(o.key);
  }
  return effective;
}