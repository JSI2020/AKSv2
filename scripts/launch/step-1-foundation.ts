import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Step 1 — real fabrics, fit profiles, house models, MTM limits (idempotent). */
async function main() {
  const {
    uuidv7,
    FABRIC_SEEDS,
    FIT_PROFILE_SEEDS,
    HOUSE_MODEL_SEEDS,
    CUSTOM_SIZE_LIMIT_SEEDS,
    formatModelDisclosure,
  } = await import("@aks/shared");
  const {
    db,
    fabrics,
    fitProfiles,
    houseModels,
    customSizeLimits,
    garmentCategories,
    sql,
  } = await import("@aks/db");
  const { eq, and } = await import("drizzle-orm");

  console.log("\n=== Launch Step 1: Foundation ===\n");

  const categories = await db
    .select({ id: garmentCategories.id, key: garmentCategories.key })
    .from(garmentCategories);
  const categoryIdByKey = new Map(categories.map((c) => [c.key, c.id]));

  let fabricsCreated = 0;
  let fabricsUpdated = 0;
  for (const f of FABRIC_SEEDS) {
    const [existing] = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(eq(fabrics.name, f.name))
      .limit(1);

    const values = {
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
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(fabrics).set(values).where(eq(fabrics.id, existing.id));
      fabricsUpdated += 1;
    } else {
      await db.insert(fabrics).values({
        id: uuidv7(),
        name: f.name,
        ...values,
      });
      fabricsCreated += 1;
    }
  }
  console.log(
    `fabrics: ${FABRIC_SEEDS.length} total (${fabricsCreated} created, ${fabricsUpdated} updated)`,
  );

  const existingFit = await db.select({ id: fitProfiles.id }).from(fitProfiles).limit(1);
  if (!existingFit.length) {
    for (const profile of FIT_PROFILE_SEEDS) {
      const categoryId = categoryIdByKey.get(profile.categoryKey);
      if (!categoryId) continue;
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
    }
    console.log(`fit_profiles: ${FIT_PROFILE_SEEDS.length} seeded`);
  } else {
    console.log(`fit_profiles: already present — skipped`);
  }

  const existingModels = await db.select({ id: houseModels.id }).from(houseModels).limit(1);
  if (!existingModels.length) {
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
    if (regular) {
      console.log(`house_models: ${HOUSE_MODEL_SEEDS.length} — ${formatModelDisclosure(regular)}`);
    }
  } else {
    console.log(`house_models: already present — skipped`);
  }

  for (const limit of CUSTOM_SIZE_LIMIT_SEEDS) {
    const categoryId = categoryIdByKey.get(limit.categoryKey);
    if (!categoryId) continue;
    const [row] = await db
      .select({ id: customSizeLimits.id })
      .from(customSizeLimits)
      .where(
        and(
          eq(customSizeLimits.categoryId, categoryId),
          eq(customSizeLimits.measurementKey, limit.measurementKey),
        ),
      )
      .limit(1);
    if (row) continue;
    await db.insert(customSizeLimits).values({
      id: uuidv7(),
      categoryId,
      measurementKey: limit.measurementKey,
      minValue: limit.minValue,
      maxValue: limit.maxValue,
      step: limit.step ?? 25,
      crossFieldRules: limit.crossFieldRules ?? [],
    });
  }
  console.log(`custom_size_limits: OK`);

  const fabricCount =
    (
      await sql<{ n: number }[]>`
    select count(*)::int as n from fabrics where active`
    )[0]?.n ?? 0;

  console.log(`\nStep 1 complete — ${fabricCount ?? 0} active fabrics.`);
  console.log("Next: npm run launch:2\n");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
