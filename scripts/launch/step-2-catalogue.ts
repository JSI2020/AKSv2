import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import {
  CATALOGUE_SWATCHES,
  HOUSE_CATALOGUE_LOOKS,
  type CatalogueLook,
} from "../../packages/db/house-catalogue-looks";

const LAUNCH_PREFIXES = [
  "essentials-",
  "tailored-",
  "occasion-",
  "signature-",
  "separates-",
] as const;

function launchSlug(look: CatalogueLook): string {
  const base = look.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${look.houseTag.toLowerCase()}-${base}`;
}

function pkr(rupees: number): number {
  return Math.round(rupees) * 100;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Step 2 — publish 50 house-collection designs (real slugs, admin publish path). */
async function main() {
  const { execSync } = await import("node:child_process");
  execSync("npx tsx scripts/ensure-default-size-block-rows.ts", {
    stdio: "inherit",
    env: process.env,
  });

  const { uuidv7, STANDARD_SIZE_LABELS } = await import("@aks/shared");
  const {
    db,
    designs,
    fabrics,
    fitProfiles,
    garmentCategories,
    sizeBlocks,
    users,
    sql,
  } = await import("@aks/db");
  const { and, eq, like, or, inArray } = await import("drizzle-orm");

  console.log("\n=== Launch Step 2: House catalogue (50 looks) ===\n");

  const categories = await db.select().from(garmentCategories);
  const categoryIdByKey = new Map(categories.map((c) => [c.key, c.id]));

  const fabricRows = await db
    .select()
    .from(fabrics)
    .where(eq(fabrics.active, true));
  if (!fabricRows.length) {
    throw new Error("No fabrics — run npm run launch:1 first");
  }

  const fitRows = await db
    .select()
    .from(fitProfiles)
    .where(eq(fitProfiles.active, true));
  const fitByCategory = new Map<string, string>();
  for (const f of fitRows) {
    const cat = categories.find((c) => c.id === f.categoryId);
    if (cat && !fitByCategory.has(cat.key)) fitByCategory.set(cat.key, f.id);
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER — set OWNER_EMAIL and run db:seed or db:post-wipe");

  const prior = await db
    .select({ id: designs.id, slug: designs.slug })
    .from(designs)
    .where(
      or(...LAUNCH_PREFIXES.map((p) => like(designs.slug, `${p}%`))),
    );

  if (prior.length) {
    await db.delete(designs).where(
      inArray(
        designs.id,
        prior.map((d) => d.id),
      ),
    );
    console.log(`removed ${prior.length} prior launch design(s)`);
  }

  const neededCategories = [
    ...new Set(HOUSE_CATALOGUE_LOOKS.map((l) => l.category)),
  ];
  const blockIdByCategory = new Map<string, string>();
  for (const cat of neededCategories) {
    const categoryId = categoryIdByKey.get(cat);
    if (!categoryId) continue;
    const [def] = await db
      .select({ id: sizeBlocks.id })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.categoryId, categoryId),
          eq(sizeBlocks.isDefault, true),
          eq(sizeBlocks.active, true),
        ),
      )
      .limit(1);
    if (def) blockIdByCategory.set(cat, def.id);
  }

  for (const cat of neededCategories) {
    if (fitByCategory.has(cat)) continue;
    const categoryId = categoryIdByKey.get(cat);
    if (!categoryId) continue;
    const fitId = uuidv7();
    await db.insert(fitProfiles).values({
      id: fitId,
      name: `${cat} house fit`,
      categoryId,
      easeByMeasurement: {},
      active: true,
      isDefault: true,
    });
    fitByCategory.set(cat, fitId);
  }

  const {
    createPublishedCatalogueDesign,
    ensureCataloguePlaceholderAsset,
  } = await import("@/modules/designs/catalogue-writer");

  const placeholderAssetId = await ensureCataloguePlaceholderAsset(owner.id);
  const actor = { id: owner.id, role: "OWNER" };

  let published = 0;
  for (const [i, look] of HOUSE_CATALOGUE_LOOKS.entries()) {
    const categoryId = categoryIdByKey.get(look.category);
    const sizeBlockId = blockIdByCategory.get(look.category);
    const fitId = fitByCategory.get(look.category);
    if (!categoryId || !sizeBlockId || !fitId) {
      throw new Error(`Missing setup for ${look.category} — run launch:1`);
    }

    const slug = launchSlug(look);
    const fabric = fabricRows[i % fabricRows.length]!;
    const fabricB = fabricRows[(i + 1) % fabricRows.length]!;
    const swatch =
      CATALOGUE_SWATCHES[look.swatchIndex % CATALOGUE_SWATCHES.length]!;
    const altSwatch =
      CATALOGUE_SWATCHES[(look.swatchIndex + 2) % CATALOGUE_SWATCHES.length]!;

    const row = await createPublishedCatalogueDesign({
      slug,
      name: look.name,
      description: `${look.name} — standard sizes XS–XL. Cut and finish are the ornament.`,
      storyCopy: look.story,
      garmentTypeId: categoryId,
      components: [look.category],
      sizeBlockId,
      fitProfileIds: { [look.category]: fitId },
      basePriceMinor: pkr(look.pricePkr),
      madeToMeasureSurchargeMinor: 0,
      fabricConsumptionMeters:
        look.category === "DUPATTA" ? 250 : look.category === "GOWN" ? 550 : 350,
      leadTimeDaysOverride: 14 + (i % 5),
      featured: Boolean(look.featured),
      tags: [
        { kind: "OCCASION", value: look.occasion },
        { kind: "SEASON", value: "SUMMER" },
        { kind: "WORK", value: look.work ?? "PLAIN" },
        { kind: "FREE", value: look.houseTag },
        ...(look.extraFreeTags ?? []).map((value) => ({
          kind: "FREE" as const,
          value,
        })),
      ],
      colourways: [
        {
          name: swatch.name,
          slug: swatch.slug,
          fabricId: fabric.id,
          hexApproximation: swatch.hex,
          isDefault: true,
          sortOrder: 0,
        },
        {
          name: altSwatch.name,
          slug: `${altSwatch.slug}-alt`,
          fabricId: fabricB.id,
          hexApproximation: altSwatch.hex,
          priceDeltaMinor: pkr(1200),
          isDefault: false,
          sortOrder: 1,
        },
      ],
      placeholderAssetId,
      actor,
      auditNote: `Launch catalogue — ${look.houseTag}`,
    });

    await db
      .update(designs)
      .set({
        publishedAt: daysAgo(i % 18),
        availableSizeLabels: STANDARD_SIZE_LABELS.filter((l) => l !== "XXL"),
      })
      .where(eq(designs.id, row.id));

    published += 1;
    if (i < 5 || i === HOUSE_CATALOGUE_LOOKS.length - 1) {
      console.log(`  ${slug}`);
    } else if (i === 5) {
      console.log(`  …`);
    }
  }

  console.log(`\nStep 2 complete — ${published} published design(s).`);
  console.log("Storefront: /en/collections/essentials");
  console.log("Next: npm run launch:3\n");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
