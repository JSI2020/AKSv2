import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function seed() {
  const shared = await import("../shared");
  const { uuidv7, ALL_PERMISSION_KEYS, ROLE_DEFAULT_PERMISSIONS, parsePermissionKey } =
    shared;
  type StaffRole = import("../shared").StaffRole;
  const { db } = await import("./client");
  const {
    pipelineProbe,
    users,
    permissions,
    rolePermissions,
    measurementKeys,
    garmentCategories,
  } = await import("./schema");
  const { eq } = await import("drizzle-orm");
  const {
    MEASUREMENT_KEY_DEFS,
    GARMENT_CATEGORY_SEEDS,
  } = shared;

  // Fixed UUIDv7 for idempotent re-seeds of the probe row (no digit-run demo OTP).
  const probeId = "01900001-2345-7890-abcd-ef1234567890";
  await db
    .insert(pipelineProbe)
    .values({ id: probeId, label: "seed-ok" })
    .onConflictDoNothing({ target: pipelineProbe.id });
  console.log(`seeded pipeline_probe ${probeId}`);

  // --- Permission catalogue + role presets ---
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
  console.log(`seeded ${ALL_PERMISSION_KEYS.length} permissions`);

  const permRows = await db
    .select({ id: permissions.id, key: permissions.key })
    .from(permissions);
  const idByKey = new Map(permRows.map((r) => [r.key, r.id]));

  const staffRoles = Object.keys(ROLE_DEFAULT_PERMISSIONS) as StaffRole[];
  for (const role of staffRoles) {
    await db.delete(rolePermissions).where(eq(rolePermissions.role, role));
    const keys = ROLE_DEFAULT_PERMISSIONS[role];
    for (const key of keys) {
      const permissionId = idByKey.get(key);
      if (!permissionId) {
        throw new Error(`Missing permission row for ${key}`);
      }
      await db.insert(rolePermissions).values({
        id: uuidv7(),
        role,
        permissionId,
      });
    }
    console.log(`seeded role_permissions for ${role} (${keys.length})`);
  }

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const ownerName = process.env.OWNER_NAME?.trim();

  if (ownerEmail && ownerName) {
    const existing = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1);

    if (existing[0]) {
      if (existing[0].role !== "OWNER") {
        console.warn(
          `OWNER_EMAIL ${ownerEmail} already exists as ${existing[0].role} — not promoting`,
        );
      } else {
        console.log(`OWNER already present: ${ownerEmail}`);
      }
    } else {
      const ownerCount = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "OWNER"))
        .limit(1);

      if (ownerCount[0]) {
        console.warn(
          "An OWNER already exists — skipping bootstrap for OWNER_EMAIL",
        );
      } else {
        const id = uuidv7();
        await db.insert(users).values({
          id,
          email: ownerEmail,
          name: ownerName,
          role: "OWNER",
          status: "ACTIVE",
          emailVerified: new Date(),
        });
        console.log(`seeded OWNER ${ownerEmail} (${id})`);
      }
    }
  } else {
    console.log("OWNER_EMAIL / OWNER_NAME not set — skipping owner bootstrap");
  }

  // --- Sizing: measurement keys + garment categories ---
  for (const def of MEASUREMENT_KEY_DEFS) {
    await db
      .insert(measurementKeys)
      .values({
        key: def.key,
        label: def.label,
        labelUr: def.labelUr,
        bodyOrGarment: def.bodyOrGarment,
        anchorPoint: def.anchorPoint,
        helpText: def.helpText,
      })
      .onConflictDoNothing({ target: measurementKeys.key });
  }
  console.log(`seeded ${MEASUREMENT_KEY_DEFS.length} measurement_keys`);

  for (const cat of GARMENT_CATEGORY_SEEDS) {
    const existing = await db
      .select({ id: garmentCategories.id })
      .from(garmentCategories)
      .where(eq(garmentCategories.key, cat.key))
      .limit(1);

    if (existing[0]) {
      await db
        .update(garmentCategories)
        .set({
          name: cat.name,
          nameUr: cat.nameUr,
          measurementKeys: [...cat.measurementKeys],
          sortOrder: cat.sortOrder,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(garmentCategories.id, existing[0].id));
      console.log(`updated garment_category ${cat.key}`);
    } else {
      await db.insert(garmentCategories).values({
        id: uuidv7(),
        key: cat.key,
        name: cat.name,
        nameUr: cat.nameUr,
        measurementKeys: [...cat.measurementKeys],
        active: true,
        sortOrder: cat.sortOrder,
      });
      console.log(`seeded garment_category ${cat.key}`);
    }
  }

  console.log(`uuidv7 sample: ${uuidv7()}`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
