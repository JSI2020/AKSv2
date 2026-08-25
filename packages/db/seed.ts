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
    sizeBlocks,
    sizeBlockRows,
    fitProfiles,
    fabrics,
    houseModels,
    customSizeLimits,
    designs,
  } = await import("./schema");
  const { and, eq } = await import("drizzle-orm");
  const {
    MEASUREMENT_KEY_DEFS,
    GARMENT_CATEGORY_SEEDS,
    DEFAULT_SIZE_BLOCK_SEEDS,
    STANDARD_SIZE_LABELS,
    DEFAULT_BASE_SIZE_LABEL,
    resolveRowValues,
    inches,
    FIT_PROFILE_SEEDS,
    applyFitEase,
    FABRIC_SEEDS,
    HOUSE_MODEL_SEEDS,
    CUSTOM_SIZE_LIMIT_SEEDS,
    formatModelDisclosure,
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

  // --- Sizing: default size blocks (replaceable placeholders) ---
  const categories = await db
    .select({ id: garmentCategories.id, key: garmentCategories.key })
    .from(garmentCategories);
  const categoryIdByKey = new Map(categories.map((c) => [c.key, c.id]));

  for (const blockSeed of DEFAULT_SIZE_BLOCK_SEEDS) {
    const categoryId = categoryIdByKey.get(blockSeed.categoryKey);
    if (!categoryId) {
      throw new Error(
        `Missing category ${blockSeed.categoryKey} for size block seed`,
      );
    }

    const existingDefaults = await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.categoryId, categoryId),
          eq(sizeBlocks.isDefault, true),
          eq(sizeBlocks.active, true),
        ),
      );

    for (const row of existingDefaults) {
      // Cascade deletes size_block_rows / size_block_cells when unreferenced.
      // Designs may still point at a prior default — retire it instead of failing.
      const linked = await db
        .select({ id: designs.id })
        .from(designs)
        .where(eq(designs.sizeBlockId, row.id))
        .limit(1);
      if (linked[0]) {
        await db
          .update(sizeBlocks)
          .set({ isDefault: false, active: false })
          .where(eq(sizeBlocks.id, row.id));
      } else {
        await db.delete(sizeBlocks).where(eq(sizeBlocks.id, row.id));
      }
    }

    const blockId = uuidv7();
    await db.insert(sizeBlocks).values({
      id: blockId,
      name: blockSeed.name,
      categoryId,
      isDefault: true,
      ownerDesignId: null,
      sizeLabels: [...STANDARD_SIZE_LABELS],
      baseSizeLabel: DEFAULT_BASE_SIZE_LABEL,
      notes: blockSeed.notes,
      active: true,
    });

    for (const row of blockSeed.rows) {
      await db.insert(sizeBlockRows).values({
        id: uuidv7(),
        blockId,
        measurementKey: row.measurementKey,
        baseValue: row.baseValue,
        gradeIncrement: row.gradeIncrement,
        gradeOverrides: row.gradeOverrides ?? {},
        sortOrder: row.sortOrder,
      });
    }
    console.log(
      `seeded size_block ${blockSeed.categoryKey} default (${blockSeed.rows.length} rows) — REPLACEABLE`,
    );
  }

  // Exit check: KAMEEZ resolves to the Step 14 chart
  const kameezSeed = DEFAULT_SIZE_BLOCK_SEEDS.find(
    (b) => b.categoryKey === "KAMEEZ",
  );
  if (!kameezSeed) throw new Error("KAMEEZ size block seed missing");
  const bust = kameezSeed.rows.find((r) => r.measurementKey === "BUST");
  const length = kameezSeed.rows.find((r) => r.measurementKey === "LENGTH");
  if (!bust || !length) throw new Error("KAMEEZ BUST/LENGTH rows missing");

  const bustResolved = resolveRowValues(
    STANDARD_SIZE_LABELS,
    DEFAULT_BASE_SIZE_LABEL,
    bust.baseValue,
    bust.gradeIncrement,
    bust.gradeOverrides ?? {},
  );
  const lengthResolved = resolveRowValues(
    STANDARD_SIZE_LABELS,
    DEFAULT_BASE_SIZE_LABEL,
    length.baseValue,
    length.gradeIncrement,
    length.gradeOverrides ?? {},
  );

  const expectedBust = [32, 34, 36, 38, 41, 44].map(inches);
  const expectedLength = [28, 29, 30, 31, 32, 33].map(inches);
  if (JSON.stringify(bustResolved) !== JSON.stringify(expectedBust)) {
    throw new Error(
      `KAMEEZ BUST resolve mismatch: got ${bustResolved.join("/")} expected ${expectedBust.join("/")}`,
    );
  }
  if (JSON.stringify(lengthResolved) !== JSON.stringify(expectedLength)) {
    throw new Error(
      `KAMEEZ LENGTH resolve mismatch: got ${lengthResolved.join("/")} expected ${expectedLength.join("/")}`,
    );
  }
  console.log(
    `KAMEEZ resolve OK — BUST ${bustResolved.map((v) => v / 100).join("/")} · LENGTH ${lengthResolved.map((v) => v / 100).join("/")}`,
  );

  // --- Fit profiles (replaceable) ---
  await db.delete(fitProfiles);
  for (const profile of FIT_PROFILE_SEEDS) {
    const categoryId = categoryIdByKey.get(profile.categoryKey);
    if (!categoryId) {
      throw new Error(`Missing category ${profile.categoryKey} for fit profile`);
    }
    await db.insert(fitProfiles).values({
      id: uuidv7(),
      name: profile.name,
      categoryId,
      easeByMeasurement: profile.easeByMeasurement,
      clingFactorBps: profile.clingFactorBps,
      isDefault: profile.isDefault ?? false,
      notes: profile.notes ?? null,
      sortOrder: profile.sortOrder,
      active: true,
    });
    console.log(`seeded fit_profile ${profile.name} (${profile.categoryKey})`);
  }

  const palazzo = FIT_PROFILE_SEEDS.find((p) => p.name === "Palazzo");
  if (!palazzo) throw new Error("Palazzo seed missing");
  const trouserM = {
    WAIST: inches(30),
    HIP: inches(38),
    BOTTOM_OPENING: inches(14),
  };
  const finished = applyFitEase(trouserM, palazzo.easeByMeasurement);
  if (
    finished.WAIST !== inches(31) ||
    finished.HIP !== inches(46) ||
    finished.BOTTOM_OPENING !== inches(24)
  ) {
    throw new Error(
      `Palazzo ease mismatch: ${JSON.stringify(finished)}`,
    );
  }
  console.log(
    `Palazzo @ M OK — waist ${finished.WAIST! / 100}″ · hip ${finished.HIP! / 100}″ · bottom ${finished.BOTTOM_OPENING! / 100}″`,
  );

  // --- Fabrics (replaceable) ---
  await db.delete(fabrics);
  for (const f of FABRIC_SEEDS) {
    await db.insert(fabrics).values({
      id: uuidv7(),
      name: f.name,
      composition: f.composition,
      weightGsm: f.weightGsm,
      widthInches: f.widthInches,
      stretchPercent: f.stretchPercent,
      shrinkageAllowance: f.shrinkageAllowance,
      drapeClass: f.drapeClass,
      costPerMeterMinor: f.costPerMeterMinor,
      careInstructions: f.careInstructions,
      drapeNotes: f.drapeNotes,
      active: true,
    });
  }
  console.log(`seeded ${FABRIC_SEEDS.length} fabrics`);

  // --- House models / archetypes ---
  await db.delete(houseModels);
  for (const m of HOUSE_MODEL_SEEDS) {
    await db.insert(houseModels).values({
      id: uuidv7(),
      name: m.name,
      isDefault: m.isDefault ?? false,
      active: true,
      heightCm: m.heightCm,
      heightInches: m.heightInches,
      bust: m.bust,
      waist: m.waist,
      hip: m.hip,
      shoulder: m.shoulder,
      wearsSizeLabel: m.wearsSizeLabel,
      buildDescription: m.buildDescription,
      identitySeed: m.identitySeed,
      referenceAssetIds: [],
      isAiGenerated: true,
    });
  }
  const regular = HOUSE_MODEL_SEEDS.find((m) => m.name === "Regular");
  if (!regular) throw new Error("Regular archetype missing");
  const disclosure = formatModelDisclosure(regular);
  const expected =
    "Model is 5'7″ (170 cm) and wears size M. Bust 36″ · Waist 28″ · Hip 38″";
  if (disclosure !== expected) {
    throw new Error(`Disclosure mismatch:\n${disclosure}\n${expected}`);
  }
  console.log(`seeded ${HOUSE_MODEL_SEEDS.length} house_models — disclosure OK`);

  const { seedStudioSettings } = await import(
    "../../modules/ai/studio/defaults"
  );
  await seedStudioSettings();
  console.log("seeded studio_settings");

  // --- Custom size limits (MTM) ---
  await db.delete(customSizeLimits);
  for (const limit of CUSTOM_SIZE_LIMIT_SEEDS) {
    const categoryId = categoryIdByKey.get(limit.categoryKey);
    if (!categoryId) {
      throw new Error(`Missing category ${limit.categoryKey} for custom limit`);
    }
    await db.insert(customSizeLimits).values({
      id: uuidv7(),
      categoryId,
      measurementKey: limit.measurementKey,
      minValue: limit.minValue,
      maxValue: limit.maxValue,
      step: limit.step ?? 25,
      crossFieldRules: limit.crossFieldRules ?? [],
    });
    console.log(
      `seeded custom_size_limit ${limit.categoryKey}/${limit.measurementKey}`,
    );
  }

  const { seedMessageTemplatesIntoDb } = await import(
    "../../modules/messaging/seed-templates"
  );
  await seedMessageTemplatesIntoDb();
  console.log("seeded message_templates");

  console.log(`uuidv7 sample: ${uuidv7()}`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
