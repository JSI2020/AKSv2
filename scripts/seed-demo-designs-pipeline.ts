/**
 * Full admin-equivalent pipeline for 50 Demo designs:
 *   10 looks × 5 house collections (Essentials, Tailored, Occasion, Signature, Separates)
 *
 * Mirrors admin tabs: Details → Photos (3+) → Sizing → Costing → Price → Publish.
 * Uses Demo* fabrics from inventory and boutique pret photos uploaded to R2.
 *
 * Run: npm run db:seed:demo-designs
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import sharp from "sharp";

import {
  CATALOGUE_SWATCHES,
  HOUSE_CATALOGUE_LOOKS,
  type CatalogueLook,
} from "../packages/db/house-catalogue-looks";
import {
  downloadDesignPhoto,
  fetchBoutiquePhotoCatalog,
  photoTripletForDesign,
} from "./demo-design-photo-sources";

function pkr(rupees: number): number {
  return Math.round(rupees) * 100;
}

function demoSlug(look: CatalogueLook): string {
  const base = look.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `demo-${look.houseTag.toLowerCase()}-${base}`;
}

function fabricMetresForCategory(category: CatalogueLook["category"]): number {
  if (category === "DUPATTA") return 250;
  if (category === "GOWN") return 550;
  return 350;
}

async function downloadAndResize(url: string): Promise<Buffer> {
  const raw = await downloadDesignPhoto(url);
  return sharp(raw)
    .resize(1200, 1600, { fit: "cover", position: "centre" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

async function main() {
  const { execSync } = await import("node:child_process");
  execSync("npx tsx scripts/ensure-house-collections.ts", {
    stdio: "inherit",
    env: process.env,
  });
  execSync("npx tsx scripts/ensure-default-size-block-rows.ts", {
    stdio: "inherit",
    env: process.env,
  });

  const { and, eq, inArray, like } = await import("drizzle-orm");
  const {
    cartLines,
    db,
    designCosts,
    designs,
    fabrics,
    fitProfiles,
    garmentCategories,
    rtwMovements,
    rtwStock,
    sizeBlocks,
    sql,
    users,
  } = await import("@aks/db");
  const { uuidv7, STANDARD_SIZE_LABELS } = await import("@aks/shared");
  const { completeUpload, uploadBufferToR2 } = await import(
    "@/modules/platform/assets/r2"
  );
  const { createPublishedCatalogueDesign } = await import(
    "@/modules/designs/catalogue-writer"
  );
  const { computeDesignCost } = await import("@/modules/money/compute");
  const { seedAndReceiveRtwForDesign } = await import(
    "@/modules/inventory/rtw-stock"
  );

  const fallbackSizeLabels = STANDARD_SIZE_LABELS.filter((l) => l !== "XXL");

  console.log("\n=== Demo design pipeline (50 looks, admin-equivalent) ===\n");

  const categories = await db.select().from(garmentCategories);
  const categoryIdByKey = new Map(categories.map((c) => [c.key, c.id]));

  const fabricRows = await db
    .select()
    .from(fabrics)
    .where(and(eq(fabrics.active, true), like(fabrics.name, "Demo %")));
  if (fabricRows.length < 5) {
    throw new Error(
      "Need Demo fabrics in inventory — run npm run db:refresh:fabrics first",
    );
  }
  console.log(`fabrics: ${fabricRows.length} Demo inventory row(s)`);

  console.log("Fetching modest pret photos from boutique catalogues…");
  const photoCatalog = await fetchBoutiquePhotoCatalog();
  for (const [cat, pool] of photoCatalog.entries()) {
    console.log(`  ${cat}: ${pool.length} product(s)`);
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
  if (!owner) throw new Error("No OWNER — run npm run db:seed first");
  const actor = { id: owner.id, role: "OWNER" };

  const prior = await db
    .select({ id: designs.id, slug: designs.slug })
    .from(designs)
    .where(like(designs.slug, "demo-%"));
  if (prior.length) {
    const ids = prior.map((d) => d.id);
    await db.delete(cartLines).where(inArray(cartLines.designId, ids));
    const rtwRows = await db
      .select({ id: rtwStock.id })
      .from(rtwStock)
      .where(inArray(rtwStock.designId, ids));
    if (rtwRows.length) {
      await db
        .delete(rtwMovements)
        .where(
          inArray(
            rtwMovements.rtwStockId,
            rtwRows.map((r) => r.id),
          ),
        );
      await db.delete(rtwStock).where(inArray(rtwStock.designId, ids));
    }
    await db.delete(designCosts).where(inArray(designCosts.designId, ids));
    await db.delete(designs).where(inArray(designs.id, ids));
    console.log(`removed ${prior.length} prior demo-* design(s)`);
  }

  const neededCategories = [
    ...new Set(HOUSE_CATALOGUE_LOOKS.map((l) => l.category)),
  ];
  const blockIdByCategory = new Map<string, string>();
  const sizeLabelsByCategory = new Map<string, string[]>();
  for (const cat of neededCategories) {
    const categoryId = categoryIdByKey.get(cat);
    if (!categoryId) continue;
    const [def] = await db
      .select({ id: sizeBlocks.id, sizeLabels: sizeBlocks.sizeLabels })
      .from(sizeBlocks)
      .where(
        and(
          eq(sizeBlocks.categoryId, categoryId),
          eq(sizeBlocks.isDefault, true),
          eq(sizeBlocks.active, true),
        ),
      )
      .limit(1);
    if (def) {
      blockIdByCategory.set(cat, def.id);
      const labels =
        def.sizeLabels?.length > 0 ? def.sizeLabels : fallbackSizeLabels;
      sizeLabelsByCategory.set(cat, [...labels]);
    }
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

  let published = 0;
  for (const [i, look] of HOUSE_CATALOGUE_LOOKS.entries()) {
    const categoryId = categoryIdByKey.get(look.category);
    const sizeBlockId = blockIdByCategory.get(look.category);
    const fitId = fitByCategory.get(look.category);
    const sizeLabels =
      sizeLabelsByCategory.get(look.category) ?? fallbackSizeLabels;
    if (!categoryId || !sizeBlockId || !fitId) {
      throw new Error(`Missing setup for ${look.category} — run launch:1`);
    }

    const slug = demoSlug(look);
    const name = `Demo ${look.name}`;
    const fabric = fabricRows[i % fabricRows.length]!;
    const fabricB = fabricRows[(i + 3) % fabricRows.length]!;
    const swatch =
      CATALOGUE_SWATCHES[look.swatchIndex % CATALOGUE_SWATCHES.length]!;
    const altSwatch =
      CATALOGUE_SWATCHES[(look.swatchIndex + 2) % CATALOGUE_SWATCHES.length]!;
    const fabricMeters = fabricMetresForCategory(look.category);

    const triplet = photoTripletForDesign(i, look.category, photoCatalog);
    const angles = ["FRONT", "THREE_QUARTER", "BACK"] as const;
    const assetIds: string[] = [];
    for (const [photoIdx, url] of triplet.urls.entries()) {
      const jpeg = await downloadAndResize(url);
      const { key } = await uploadBufferToR2({
        body: jpeg,
        mime: "image/jpeg",
        keyPrefix: `designs/demo/${slug}`,
      });
      const asset = await completeUpload({
        key,
        mime: "image/jpeg",
        uploadedById: owner.id,
        kind: "IMAGE",
      });
      assetIds.push(asset.id);
      if (photoIdx === 0) {
        console.log(`  photos ${slug} ← ${triplet.productTitle.slice(0, 48)}…`);
      }
    }

    const renderSpecs = [
      ...angles.map((angle, idx) => ({
        colourwayIndex: 0,
        angle,
        assetId: assetIds[idx]!,
        altText: `${name} in ${swatch.name}, ${angle.toLowerCase().replace(/_/g, " ")} view`,
        sortOrder: idx,
      })),
      {
        colourwayIndex: 1,
        angle: "FRONT" as const,
        assetId: assetIds[1]!,
        altText: `${name} in ${altSwatch.name}, front view`,
        sortOrder: 3,
      },
    ];

    const row = await createPublishedCatalogueDesign({
      slug,
      name,
      description: `${name} — standard sizes XS–XL. ${look.story}`,
      storyCopy: look.story,
      garmentTypeId: categoryId,
      components: [look.category],
      sizeBlockId,
      fitProfileIds: { [look.category]: fitId },
      basePriceMinor: pkr(look.pricePkr),
      madeToMeasureSurchargeMinor: 0,
      fabricConsumptionMeters: fabricMeters,
      leadTimeDaysOverride: 14 + (i % 5),
      featured: Boolean(look.featured),
      tags: [
        { kind: "OCCASION", value: look.occasion },
        { kind: "SEASON", value: "SUMMER" },
        { kind: "WORK", value: look.work ?? "PLAIN" },
        { kind: "FREE", value: look.houseTag },
        { kind: "FREE", value: "DEMO" },
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
      renderSpecs,
      availableSizeLabels: sizeLabels,
      placeholderAssetId: assetIds[0]!,
      actor,
      auditNote: `Demo pipeline — ${look.houseTag}`,
    });

    await db
      .update(designs)
      .set({
        availableSizeLabels: sizeLabels,
      })
      .where(eq(designs.id, row.id));

    const breakdown = computeDesignCost({
      fabricCostPerMeterMinor: fabric.costPerMeterMinor,
      fabricMeters,
      embroideryRateId: null,
      embroideryFlatMinor: look.work === "EMBROIDERED" ? pkr(3500) : 0,
      stitchingRateId: null,
      stitchingFlatMinor: pkr(4500),
      packagingMinor: pkr(200),
      shippingMinor: pkr(350),
      overheadMinor: pkr(1800),
      aiCostMinor: 0,
      sellingPriceMinor: pkr(look.pricePkr),
      ratesById: new Map(),
    });

    await db
      .insert(designCosts)
      .values({
        designId: row.id,
        fabricId: fabric.id,
        fabricMeters,
        embroideryRateId: null,
        embroideryFlatMinor: look.work === "EMBROIDERED" ? pkr(3500) : 0,
        stitchingRateId: null,
        stitchingFlatMinor: pkr(4500),
        packagingMinor: pkr(200),
        shippingMinor: pkr(350),
        overheadMinor: pkr(1800),
        costingMode: "DETAILED_PER_PIECE",
        pieceCosts: [],
        totalLumpsumMinor: null,
        aiCostMinor: 0,
        totalCostMinor: breakdown.totalCostMinor,
        sellingPriceMinor: pkr(look.pricePkr),
        marginPercent: breakdown.marginPercent,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: designCosts.designId,
        set: {
          fabricId: fabric.id,
          fabricMeters,
          totalCostMinor: breakdown.totalCostMinor,
          sellingPriceMinor: pkr(look.pricePkr),
          marginPercent: breakdown.marginPercent,
          updatedAt: new Date(),
        },
      });

    published += 1;
    if (i < 3 || i === HOUSE_CATALOGUE_LOOKS.length - 1) {
      console.log(`  ✓ ${name} (${look.houseTag})`);
    } else if (i === 3) {
      console.log("  …");
    }
  }

  console.log("\nSeeding RTW inventory (5 units per size × colourway)…");
  const demoDesigns = await db
    .select({
      id: designs.id,
      name: designs.name,
      availableSizeLabels: designs.availableSizeLabels,
    })
    .from(designs)
    .where(like(designs.slug, "demo-%"));
  let totalRows = 0;
  let totalUnits = 0;
  for (const d of demoDesigns) {
    const labels =
      d.availableSizeLabels?.length > 0
        ? d.availableSizeLabels
        : fallbackSizeLabels;
    const result = await db.transaction((tx) =>
      seedAndReceiveRtwForDesign(
        tx,
        d.id,
        labels,
        5,
        owner.id,
        "Demo pipeline opening stock",
      ),
    );
    totalRows += result.rowsCreated;
    totalUnits += result.unitsReceived;
  }
  console.log(
    `  ${demoDesigns.length} design(s) — ${totalRows} new row(s), ${totalUnits} units received`,
  );

  console.log(`\nDemo pipeline complete — ${published} published design(s).`);
  console.log("Admin designs: /admin/designs");
  console.log("Inventory: /admin/inventory/designs");
  console.log("Collections: /en/collections/essentials · tailored · occasion · signature · separates\n");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
