import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Upserts content.* (and any missing) permission keys into role presets.
 * Does not touch fabrics/designs — safe after content schema land.
 */
async function main() {
  const {
    uuidv7,
    ALL_PERMISSION_KEYS,
    ROLE_DEFAULT_PERMISSIONS,
    parsePermissionKey,
  } = await import("@aks/shared");
  type StaffRole = import("@aks/shared").StaffRole;
  const { db, permissions, rolePermissions } = await import("@aks/db");
  const { eq } = await import("drizzle-orm");

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

  const staffRoles = Object.keys(ROLE_DEFAULT_PERMISSIONS) as StaffRole[];
  for (const role of staffRoles) {
    await db.delete(rolePermissions).where(eq(rolePermissions.role, role));
    for (const key of ROLE_DEFAULT_PERMISSIONS[role]) {
      const permissionId = idByKey.get(key);
      if (!permissionId) throw new Error(`Missing permission ${key}`);
      await db.insert(rolePermissions).values({
        id: uuidv7(),
        role,
        permissionId,
      });
    }
  }

  console.log(
    `permissions synced (${ALL_PERMISSION_KEYS.length} keys, ${staffRoles.length} roles)`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
