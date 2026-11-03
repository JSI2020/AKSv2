/**
 * Soft-launch AI catalogue: fal text→image photos + admin catalogue-writer publish.
 * Same house looks (quiet-luxury pret) as last time — no boutique/Unsplash reuse.
 * Zero RTW on-hand (catalogue-writer only seeds qty 0). Skips launch:3 receive.
 *
 * Run on the app host / container with FAL_KEY + R2/MinIO + DATABASE_URL:
 *   npx tsx scripts/launch/ai-catalogue-pipeline.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import sharp from "sharp";

import {
  CATALOGUE_SWATCHES,
  HOUSE_CATALOGUE_LOOKS,
  type CatalogueLook,
  type HouseTag,
} from "../../packages/db/house-catalogue-looks";

/** Extra looks to land in the 60–70 range. */
const EXTRA_LOOKS: CatalogueLook[] = [
  {
    category: "KAMEEZ",
    name: "Soft Panel Day Kurta",
    story: "Panelled front in washed cotton — the cut does the talking.",
    occasion: "EVERYDAY",
    pricePkr: 25_000,
    houseTag: "ESSENTIALS",
    swatchIndex: 2,
  },
  {
    category: "KAMEEZ",
    name: "Bone Soft Shirt Kurta",
    story: "Shirt collar, soft length — office to evening without noise.",
    occasion: "OFFICE",
    pricePkr: 27_000,
    houseTag: "ESSENTIALS",
    swatchIndex: 2,
  },
  {
    category: "TROUSER",
    name: "Taper Soft Pant",
    story: "Clean taper in tonal cloth — the everyday foundation.",
    occasion: "EVERYDAY",
    pricePkr: 17_500,
    houseTag: "ESSENTIALS",
    swatchIndex: 5,
  },
  {
    category: "KAMEEZ",
    name: "Structured Soft Blazer",
    story: "Light structure, no padding show — Tailored in soft neutrals.",
    occasion: "OFFICE",
    pricePkr: 42_000,
    houseTag: "TAILORED",
    swatchIndex: 6,
    featured: true,
  },
  {
    category: "KAMEEZ",
    name: "Long Soft Overshirt",
    story: "Layering length in stone — Tailored for real wardrobes.",
    occasion: "CASUAL",
    pricePkr: 31_000,
    houseTag: "TAILORED",
    swatchIndex: 5,
  },
  {
    category: "GOWN",
    name: "Soft Column Evening",
    story: "Straight fall, quiet cloth — Occasion without embroidery.",
    occasion: "EVENING",
    pricePkr: 55_000,
    houseTag: "OCCASION",
    swatchIndex: 1,
  },
  {
    category: "KAMEEZ",
    name: "Flared Soft Anarkali",
    story: "Controlled flare from the hip — Occasion, cut not gathered.",
    occasion: "EVENING",
    pricePkr: 48_000,
    houseTag: "OCCASION",
    swatchIndex: 3,
  },
  {
    category: "KAMEEZ",
    name: "Milk Soft Kalidaar",
    story: "White Collection kalidaar — milk cloth, clean panels.",
    occasion: "EVERYDAY",
    pricePkr: 36_000,
    houseTag: "SIGNATURE",
    swatchIndex: 0,
    extraFreeTags: ["WHITE_COLLECTION"],
    featured: true,
  },
  {
    category: "KAMEEZ",
    name: "Ivory Soft Angrakha Mini",
    story: "Shorter angrakha wrap — Signature white line.",
    occasion: "CASUAL",
    pricePkr: 34_000,
    houseTag: "SIGNATURE",
    swatchIndex: 1,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "DUPATTA",
    name: "Ivory Soft Dupatta",
    story: "Hand-rolled edge on ivory mulmul — completes Signature.",
    occasion: "EVERYDAY",
    pricePkr: 11_500,
    houseTag: "SIGNATURE",
    swatchIndex: 1,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "SKIRT",
    name: "A-Line Soft Skirt",
    story: "Separate foundation in bone — builds every look.",
    occasion: "EVERYDAY",
    pricePkr: 20_000,
    houseTag: "SEPARATES",
    swatchIndex: 2,
  },
  {
    category: "TROUSER",
    name: "Pleat Soft Culotte",
    story: "Soft pleat, tonal cloth — Separates building block.",
    occasion: "CASUAL",
    pricePkr: 19_500,
    houseTag: "SEPARATES",
    swatchIndex: 4,
  },
  {
    category: "KAMEEZ",
    name: "Soft Slip Underlayer",
    story: "Quiet underlayer in milk — Separates arithmetic.",
    occasion: "EVERYDAY",
    pricePkr: 14_000,
    houseTag: "SEPARATES",
    swatchIndex: 0,
  },
  {
    category: "DUPATTA",
    name: "Stone Soft Stole",
    story: "Narrow stole in stone — travels across doors.",
    occasion: "EVERYDAY",
    pricePkr: 10_500,
    houseTag: "SEPARATES",
    swatchIndex: 5,
  },
  {
    category: "KAMEEZ",
    name: "Oyster Soft Tunic",
    story: "Easy tunic length — Essentials for warm days.",
    occasion: "CASUAL",
    pricePkr: 23_500,
    houseTag: "ESSENTIALS",
    swatchIndex: 3,
  },
];

const ALL_LOOKS: CatalogueLook[] = [...HOUSE_CATALOGUE_LOOKS, ...EXTRA_LOOKS];

const LAUNCH_PREFIXES = [
  "essentials-",
  "tailored-",
  "occasion-",
  "signature-",
  "separates-",
] as const;

const NEGATIVE =
  "logo, brand mark, heavy embroidery, sequins, glitter, neon, plastic shine, " +
  "western blazer with peak lapels, low cut, sheer lingerie, text watermark, " +
  "busy print, cartoon, deformed hands, extra limbs";

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

function garmentPrompt(look: CatalogueLook, swatchHex: string, swatchName: string): string {
  const piece =
    look.category === "TROUSER"
      ? "women's trousers / shalwar, full-length, modest"
      : look.category === "DUPATTA"
        ? "soft dupatta / stole draped, fabric texture clear"
        : look.category === "SKIRT"
          ? "women's skirt, modest length, clean silhouette"
          : look.category === "GOWN"
            ? "floor-length gown column, modest neckline"
            : "women's kurta / kameez, modest neckline, full sleeve or bracelet length";

  return [
    `Photoreal fashion catalogue photograph of a quiet-luxury Pakistani pret ${piece}.`,
    `Look name mood: ${look.name}. ${look.story}`,
    `Cloth colour approximately ${swatchName} (${swatchHex}), natural fibre hand — lawn, linen, khaddi, silk crepe or soft cotton as fits the piece.`,
    "South Asian woman model, elegant, natural makeup, calm pose, three-quarter standing or soft weight shift.",
    "Soft studio light, bone/ivory seamless backdrop, motion in drape not flat-lay.",
    "No logos, no heavy embroidery, cut and cloth are the ornament.",
    "High detail textile weave, 2:3 portrait, commercial catalogue quality.",
  ].join(" ");
}

async function main() {
  if (!process.env.FAL_KEY?.trim()) {
    throw new Error("FAL_KEY is required — live AI photos, not placeholders");
  }
  if (process.env.AI_GENERATION_MOCK === "1") {
    throw new Error("AI_GENERATION_MOCK=1 — refuse mock for this pipeline");
  }

  const { execSync } = await import("node:child_process");
  execSync("npx tsx scripts/ensure-default-size-block-rows.ts", {
    stdio: "inherit",
    env: process.env,
  });
  execSync("npx tsx scripts/ensure-house-collections.ts", {
    stdio: "inherit",
    env: process.env,
  });

  const { uuidv7, STANDARD_SIZE_LABELS } = await import("@aks/shared");
  const {
    announcements,
    db,
    designs,
    fabrics,
    fitProfiles,
    garmentCategories,
    sizeBlocks,
    siteSettings,
    sql,
    users,
  } = await import("@aks/db");
  const { and, eq, like, or, inArray } = await import("drizzle-orm");
  const { generateFromText } = await import(
    "@/modules/photoreal/providers/fal-photoreal"
  );
  const { completeUpload, uploadBufferToR2 } = await import(
    "@/modules/platform/assets/r2"
  );
  const {
    createPublishedCatalogueDesign,
    ensureCataloguePlaceholderAsset,
  } = await import("@/modules/designs/catalogue-writer");
  const { seedContentDefaults } = await import(
    "@/modules/content/seed-defaults"
  );
  const { DEFAULT_SITE_SETTINGS } = await import("@/modules/content/types");

  console.log(
    `\n=== AI catalogue pipeline (${ALL_LOOKS.length} looks, fal photos, zero stock) ===\n`,
  );

  // Coming-soon ticker + WhatsApp
  await seedContentDefaults();
  const [storefront] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, "storefront"))
    .limit(1);
  const current =
    storefront?.value && typeof storefront.value === "object"
      ? (storefront.value as Record<string, unknown>)
      : {};
  await db
    .update(siteSettings)
    .set({
      value: {
        ...DEFAULT_SITE_SETTINGS,
        ...current,
        whatsappUrl: "https://wa.me/923378520110",
        instagramUrl: "https://www.instagram.com/aksatelier.official/",
        facebookUrl: "https://www.facebook.com/profile.php?id=61594255361658",
        tiktokUrl: "https://www.tiktok.com/@aksatelier.official",
      },
      updatedAt: new Date(),
    })
    .where(eq(siteSettings.key, "storefront"));
  console.log("storefront socials → WhatsApp, Instagram, Facebook, TikTok");

  const existingAnn = await db.select().from(announcements);
  const comingSoonMsg =
    "Coming soon — the White Collection and house doors are being prepared. Browse the looks; stock arrives shortly.";
  if (existingAnn.length === 0) {
    await db.insert(announcements).values({
      id: uuidv7(),
      message: comingSoonMsg,
      link: null,
      sortOrder: 0,
      active: true,
    });
  } else {
    for (const a of existingAnn) {
      await db
        .update(announcements)
        .set({ message: comingSoonMsg, active: true, updatedAt: new Date() })
        .where(eq(announcements.id, a.id));
    }
  }
  console.log("announcement ticker → Coming soon");

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
  if (!owner) throw new Error("No OWNER user");

  const prior = await db
    .select({ id: designs.id, slug: designs.slug })
    .from(designs)
    .where(or(...LAUNCH_PREFIXES.map((p) => like(designs.slug, `${p}%`))));
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
    ...new Set(ALL_LOOKS.map((l) => l.category)),
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

  const placeholderAssetId = await ensureCataloguePlaceholderAsset(owner.id);
  const actor = { id: owner.id, role: "OWNER" };
  const sizeLabels = [...STANDARD_SIZE_LABELS];

  let published = 0;
  let failed = 0;

  for (const [i, look] of ALL_LOOKS.entries()) {
    const categoryId = categoryIdByKey.get(look.category);
    const sizeBlockId = blockIdByCategory.get(look.category);
    const fitId = fitByCategory.get(look.category);
    if (!categoryId || !sizeBlockId || !fitId) {
      throw new Error(`Missing setup for ${look.category}`);
    }

    const slug = launchSlug(look);
    const fabric = fabricRows[i % fabricRows.length]!;
    const fabricB = fabricRows[(i + 1) % fabricRows.length]!;
    const swatch =
      CATALOGUE_SWATCHES[look.swatchIndex % CATALOGUE_SWATCHES.length]!;
    const altSwatch =
      CATALOGUE_SWATCHES[(look.swatchIndex + 2) % CATALOGUE_SWATCHES.length]!;

    console.log(`[${i + 1}/${ALL_LOOKS.length}] fal → ${slug}`);
    const gen = await generateFromText({
      prompt: garmentPrompt(look, swatch.hex, swatch.name),
      negativePrompt: NEGATIVE,
      seed: 42000 + i,
    });

    let frontAssetId = placeholderAssetId;
    if (!gen.ok) {
      console.error(`  fal failed: ${gen.error} — publishing with placeholder`);
      failed += 1;
    } else {
      const res = await fetch(gen.imageUrl);
      if (!res.ok) throw new Error(`download fal image ${res.status}`);
      const raw = Buffer.from(await res.arrayBuffer());
      const jpeg = await sharp(raw)
        .resize(1200, 1600, { fit: "cover", position: "centre" })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
      const { key } = await uploadBufferToR2({
        body: jpeg,
        mime: "image/jpeg",
        keyPrefix: `catalogue/ai/${slug}`,
      });
      const asset = await completeUpload({
        key,
        mime: "image/jpeg",
        uploadedById: owner.id,
        kind: "IMAGE",
        isAiGenerated: true,
      });
      frontAssetId = asset.id;
      console.log(`  asset ${asset.id.slice(0, 8)}… ($${gen.costUsd})`);
    }

    const row = await createPublishedCatalogueDesign({
      slug,
      name: look.name,
      description: `${look.name} — standard sizes XS–XXL. Cut and finish are the ornament.`,
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
      renderSpecs: [
        {
          colourwayIndex: 0,
          angle: "FRONT",
          assetId: frontAssetId,
          altText: `${look.name} in ${swatch.name}, front view`,
          sortOrder: 0,
          isAiGenerated: frontAssetId !== placeholderAssetId,
        },
        {
          colourwayIndex: 1,
          angle: "FRONT",
          assetId: frontAssetId,
          altText: `${look.name} in ${altSwatch.name}, front view`,
          sortOrder: 1,
          isAiGenerated: frontAssetId !== placeholderAssetId,
        },
      ],
      placeholderAssetId,
      availableSizeLabels: sizeLabels,
      actor,
      auditNote: `AI catalogue (fal) — ${look.houseTag as HouseTag}`,
    });

    await db
      .update(designs)
      .set({
        publishedAt: new Date(),
        availableSizeLabels: sizeLabels,
      })
      .where(eq(designs.id, row.id));

    published += 1;
  }

  console.log(
    `\nDone — ${published} published, ${failed} fal fallback(s). Zero RTW on-hand (seeded rows only).`,
  );
  console.log("Do NOT run launch:3 if you want to keep inventory at zero.\n");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
