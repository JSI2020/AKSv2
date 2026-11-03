/**
 * Drive the Admin portal (Playwright) to rebuild soft-launch catalogue:
 * fabrics with AI swatches → fit profiles → 50 Pakistani East–West designs
 * via admin publish path (catalogue-writer = same checklist as UI publish)
 * → homepage hero/doors with AI White Collection stills.
 *
 * Photos: public/aks-merch/{swatches,looks,hero} — AI-generated AKS looks.
 * Run: npx tsx --env-file=.env.local scripts/admin-portal-rebuild.ts
 */
import { config } from "dotenv";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

const BASE = process.env.ADMIN_BASE_URL ?? "http://localhost:3000";
const ROOT = process.cwd();
const SWATCH_DIR = path.join(ROOT, "public/aks-merch/swatches");
const LOOK_DIR = path.join(ROOT, "public/aks-merch/looks");
const HERO_DIR = path.join(ROOT, "public/aks-merch/hero");

const FABRICS: Array<{
  name: string;
  composition: string;
  character: string;
  drape: "Light" | "Medium" | "Heavy";
  price: string;
  metres: string;
  lot: string;
  swatch: string;
  care: string;
}> = [
  {
    name: "Khaddi Milk",
    composition: "Handloom cotton khaddi",
    character: "Matte weave — the cloth is the ornament",
    drape: "Medium",
    price: "1800",
    metres: "80",
    lot: "AKS-KH-MILK-01",
    swatch: "swatch-khaddi-milk.jpg",
    care: "Hand wash cold, line dry, warm iron",
  },
  {
    name: "Linen Bone",
    composition: "100% European linen",
    character: "Washes soft; holds a quiet Western line",
    drape: "Medium",
    price: "2200",
    metres: "70",
    lot: "AKS-LN-BONE-01",
    swatch: "swatch-linen-bone.jpg",
    care: "Machine wash cold, line dry",
  },
  {
    name: "Mulmul Ivory",
    composition: "Fine cotton mulmul",
    character: "Airy, breathable — summer skin",
    drape: "Light",
    price: "1400",
    metres: "90",
    lot: "AKS-MU-IVORY-01",
    swatch: "swatch-mulmul-ivory.jpg",
    care: "Gentle wash, shade dry",
  },
  {
    name: "Cotton-Silk Oyster",
    composition: "Cotton-silk blend",
    character: "Low sheen; day-to-evening drape",
    drape: "Medium",
    price: "2600",
    metres: "60",
    lot: "AKS-CS-OYSTER-01",
    swatch: "swatch-cotton-silk-oyster.jpg",
    care: "Dry clean or gentle hand wash",
  },
  {
    name: "Organza Bone",
    composition: "Silk organza",
    character: "Sheer structure without noise",
    drape: "Light",
    price: "3200",
    metres: "40",
    lot: "AKS-OR-BONE-01",
    swatch: "swatch-organza-bone.jpg",
    care: "Dry clean only",
  },
  {
    name: "Lawn Sand",
    composition: "Cotton lawn",
    character: "Crisp fine weave for everyday kurtas",
    drape: "Light",
    price: "1200",
    metres: "100",
    lot: "AKS-LW-SAND-01",
    swatch: "swatch-lawn-sand.jpg",
    care: "Machine wash cold, iron warm",
  },
  {
    name: "Silk Crepe Taupe",
    composition: "Pure silk crepe",
    character: "Fluid weight; evening calm",
    drape: "Medium",
    price: "4500",
    metres: "35",
    lot: "AKS-SC-TAUPE-01",
    swatch: "swatch-silk-crepe-taupe.jpg",
    care: "Dry clean only",
  },
  {
    name: "Khaddar Stone",
    composition: "Handloom khaddar cotton",
    character: "Textured winter-ready body",
    drape: "Heavy",
    price: "1600",
    metres: "55",
    lot: "AKS-KD-STONE-01",
    swatch: "swatch-khaddar-stone.jpg",
    care: "Hand wash, line dry",
  },
  {
    name: "Cotton Tea Rose",
    composition: "Soft cotton",
    character: "Muted blush — a soft accent for the everyday",
    drape: "Medium",
    price: "1500",
    metres: "50",
    lot: "AKS-CT-TEAROSE-01",
    swatch: "swatch-cotton-tea-rose.jpg",
    care: "Gentle wash, shade dry",
  },
  {
    name: "Silk Antique Gold",
    composition: "Silk blend",
    character: "Warm muted gold, never shiny",
    drape: "Medium",
    price: "3800",
    metres: "30",
    lot: "AKS-SG-ANTIQUE-01",
    swatch: "swatch-silk-antique-gold.jpg",
    care: "Dry clean only",
  },
  {
    name: "Linen Soft Olive",
    composition: "100% linen",
    character: "Muted green for quiet contrast",
    drape: "Medium",
    price: "2100",
    metres: "45",
    lot: "AKS-LN-OLIVE-01",
    swatch: "swatch-linen-soft-olive.jpg",
    care: "Machine wash cold, line dry",
  },
  {
    name: "Cotton Espresso",
    composition: "Soft cotton",
    character: "Deep anchor for tailored looks",
    drape: "Medium",
    price: "1550",
    metres: "40",
    lot: "AKS-CT-ESPRESSO-01",
    swatch: "swatch-cotton-espresso.jpg",
    care: "Gentle wash, line dry",
  },
];

function lookFiles(): string[] {
  return fs
    .readdirSync(LOOK_DIR)
    .filter(
      (f) =>
        /\.(jpe?g|png)$/i.test(f) &&
        !f.startsWith("swatch-") &&
        (f.startsWith("look-") || f.startsWith("hero-")),
    )
    .map((f) => path.join(LOOK_DIR, f));
}

function heroFiles(): string[] {
  const fromHero = fs.existsSync(HERO_DIR)
    ? fs.readdirSync(HERO_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f))
    : [];
  if (fromHero.length) return fromHero.map((f) => path.join(HERO_DIR, f));
  return lookFiles().slice(0, 6);
}

async function mintOtp(): Promise<string> {
  const out = execSync("npx tsx --env-file=.env.local scripts/dev-admin-code.ts", {
    encoding: "utf8",
    cwd: ROOT,
  });
  const m = out.match(/code:\s*(\d{6})/);
  if (!m) throw new Error("Could not mint admin OTP");
  return m[1]!;
}

async function uploadAssetViaPage(
  page: import("playwright").Page,
  filePath: string,
): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const mime = filePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const b64 = buf.toString("base64");
  const assetId = await page.evaluate(
    async ({ b64, mime, name }) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], name, { type: mime });
      const presignRes = await fetch("/api/assets/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: name,
          mime,
          bytes: file.size,
          kind: "IMAGE",
        }),
      });
      if (!presignRes.ok) throw new Error(await presignRes.text());
      const { url, key } = (await presignRes.json()) as {
        url: string;
        key: string;
      };
      const put = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "content-type": mime },
      });
      if (!put.ok) throw new Error(`PUT ${put.status}`);
      const complete = await fetch("/api/assets/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, mime, kind: "IMAGE" }),
      });
      if (!complete.ok) throw new Error(await complete.text());
      const json = (await complete.json()) as { id?: string; assetId?: string };
      return json.id ?? json.assetId ?? "";
    },
    { b64, mime, name: path.basename(filePath) },
  );
  if (!assetId) throw new Error(`No asset id for ${filePath}`);
  return assetId;
}

async function main() {
  const { chromium } = await import("playwright");
  console.log("\n=== Admin portal rebuild (Pakistani East–West) ===\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // --- Login (dev OTP auto-fills after Send code) ---
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "owner@aks.local");
  await page.click('button:has-text("Send code")');
  await page.waitForSelector('input[name="otp"]', { timeout: 15000 });
  const otpInput = page.locator('input[name="otp"]');
  // Wait for dev autofill; fall back to minted code
  await page.waitForTimeout(800);
  let otpVal = await otpInput.inputValue();
  if (!otpVal || otpVal.length < 6) {
    otpVal = await mintOtp();
    await otpInput.fill(otpVal);
  }
  console.log(`  otp ready (${otpVal.length} digits)`);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.includes("/login"), {
    timeout: 30000,
  });
  console.log("✓ signed in");

  // --- Fabrics via Admin UI (skip names already present) ---
  await page.goto(`${BASE}/admin/fabrics`, { waitUntil: "networkidle" });
  const existingNames = new Set(
    await page.locator("h2").allTextContents().then((t) => t.map((x) => x.trim())),
  );

  for (const f of FABRICS) {
    if (existingNames.has(f.name)) {
      console.log(`· fabric exists ${f.name}`);
      continue;
    }
    const swatchPath = path.join(SWATCH_DIR, f.swatch);
    if (!fs.existsSync(swatchPath)) {
      throw new Error(`Missing swatch ${swatchPath}`);
    }
    await page.goto(`${BASE}/admin/fabrics/new`, { waitUntil: "networkidle" });
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(swatchPath);
    await page.waitForFunction(() => {
      const hidden = document.querySelector(
        'input[name="swatchAssetId"]',
      ) as HTMLInputElement | null;
      return Boolean(hidden?.value && hidden.value.length > 10);
    }, { timeout: 30000 });
    await page.fill('input[name="name"]', f.name);
    await page.fill('input[name="composition"]', f.composition);
    await page.fill('input[name="drapeNotes"]', f.character);
    await page.click(`button:has-text("${f.drape}")`);
    await page.fill('input[name="costRupees"]', f.price);
    await page.fill('input[name="startingMetres"]', f.metres);
    await page.fill('input[name="startingLotCode"]', f.lot);
    await page.fill('textarea[name="careInstructions"]', f.care);
    await page.click('button:has-text("Save fabric")');
    await page.waitForURL(/\/admin\/fabrics(\/|$)/, { timeout: 30000 });
    // Confirm leave create form
    if (page.url().includes("/new")) {
      await page.waitForTimeout(2000);
    }
    console.log(`✓ fabric ${f.name}`);
    existingNames.add(f.name);
  }

  await browser.close();

  // --- Fit profiles + designs via admin publish path ---
  const { eq } = await import("drizzle-orm");
  const {
    db,
    fabrics,
    fitProfiles,
    garmentCategories,
    sizeBlocks,
    sql,
    users,
    heroSlides,
    homepages,
    categoryTiles,
  } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");
  const {
    HOUSE_CATALOGUE_LOOKS,
    CATALOGUE_SWATCHES,
  } = await import("../packages/db/house-catalogue-looks");
  const { FIT_PROFILE_SEEDS } = await import("@aks/shared");
  const { completeUpload, saveLocalDevAsset, uploadBufferToR2 } = await import(
    "@/modules/platform/assets/r2"
  );
  const { seedContentDefaults } = await import("@/modules/content/seed-defaults");
  const {
    createPublishedCatalogueDesign,
  } = await import("@/modules/designs/catalogue-writer");
  const { STOREFRONT_RTW_SIZE_LABELS } = await import("@/modules/catalog/types");

  const [owner] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER");

  const cats = await db.select().from(garmentCategories);
  const categoryIdByKey = new Map(cats.map((c) => [c.key, c.id]));

  const existingFit = await db.select().from(fitProfiles);
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
    console.log(`✓ fit profiles (${FIT_PROFILE_SEEDS.length})`);
  }
  // House catalogue also uses DUPATTA + SKIRT — ensure defaults exist
  for (const extra of [
    { key: "DUPATTA", name: "Soft stole", ease: { LENGTH: 0 } },
    { key: "SKIRT", name: "A-line soft", ease: { WAIST: 100, HIP: 200 } },
  ] as const) {
    const categoryId = categoryIdByKey.get(extra.key);
    if (!categoryId) continue;
    const has = (await db.select({ id: fitProfiles.id }).from(fitProfiles).where(eq(fitProfiles.categoryId, categoryId)).limit(1))[0];
    if (has) continue;
    await db.insert(fitProfiles).values({
      id: uuidv7(),
      name: extra.name,
      categoryId,
      easeByMeasurement: extra.ease,
      clingFactorBps: 40,
      isDefault: true,
      notes: "AKS house default",
      sortOrder: 10,
      active: true,
    });
    console.log(`✓ fit profile ${extra.key}`);
  }

  const fabricRows = await db
    .select({ id: fabrics.id, name: fabrics.name })
    .from(fabrics)
    .where(eq(fabrics.active, true));
  if (fabricRows.length < 10) {
    throw new Error(`Expected ≥10 fabrics from Admin UI, got ${fabricRows.length}`);
  }
  console.log(`✓ ${fabricRows.length} fabrics in DB`);

  // Upload look assets
  const lookPaths = lookFiles();
  if (lookPaths.length < 8) throw new Error("Need more look photos in public/aks-merch/looks");
  const lookAssetIds: string[] = [];
  for (const fp of lookPaths) {
    const body = fs.readFileSync(fp);
    const mime = fp.endsWith(".png") ? "image/png" : "image/jpeg";
    const { key } = await uploadBufferToR2({
      body,
      mime,
      keyPrefix: "aks-merch/looks",
    });
    try {
      saveLocalDevAsset(key, body);
    } catch {
      /* ok */
    }
    const asset = await completeUpload({
      key,
      mime,
      uploadedById: owner.id,
      kind: "IMAGE",
    });
    lookAssetIds.push(asset.id);
  }
  console.log(`✓ ${lookAssetIds.length} look assets`);

  const blocks = await db.select().from(sizeBlocks);
  const blockIdByCategory = new Map<string, string>();
  for (const b of blocks) {
    const cat = cats.find((c) => c.id === b.categoryId);
    if (cat && !blockIdByCategory.has(cat.key)) {
      blockIdByCategory.set(cat.key, b.id);
    }
  }

  const fits = await db.select().from(fitProfiles);
  const fitByCategory = new Map<string, string>();
  for (const f of fits) {
    const cat = cats.find((c) => c.id === f.categoryId);
    if (cat && !fitByCategory.has(cat.key)) fitByCategory.set(cat.key, f.id);
  }

  function pkr(rupees: number) {
    return Math.round(rupees) * 100;
  }

  const { designs, designRenders, designTags, colourways } = await import("@aks/db");
  // Clear leftover DRAFTs from a prior failed publish attempt
  const leftover = await db
    .select({ id: designs.id, slug: designs.slug, status: designs.status })
    .from(designs);
  for (const row of leftover) {
    if (row.status !== "PUBLISHED") {
      await db.delete(designRenders).where(eq(designRenders.designId, row.id));
      await db.delete(designTags).where(eq(designTags.designId, row.id));
      await db.delete(colourways).where(eq(colourways.designId, row.id));
      await db.delete(designs).where(eq(designs.id, row.id));
      console.log(`  cleared draft ${row.slug}`);
    }
  }
  const existingDesigns = await db
    .select({ slug: designs.slug, status: designs.status })
    .from(designs);
  const publishedSlugs = new Set(
    existingDesigns.filter((d) => d.status === "PUBLISHED").map((d) => d.slug),
  );

  let published = publishedSlugs.size;
  for (const [i, look] of HOUSE_CATALOGUE_LOOKS.entries()) {
    const categoryId = categoryIdByKey.get(look.category);
    const sizeBlockId = blockIdByCategory.get(look.category);
    const fitId = fitByCategory.get(look.category);
    if (!categoryId || !sizeBlockId || !fitId) {
      throw new Error(`Missing setup for ${look.category}`);
    }
    const fabric = fabricRows[i % fabricRows.length]!;
    const fabricB = fabricRows[(i + 1) % fabricRows.length]!;
    const swatch =
      CATALOGUE_SWATCHES[look.swatchIndex % CATALOGUE_SWATCHES.length]!;
    const altSwatch =
      CATALOGUE_SWATCHES[(look.swatchIndex + 2) % CATALOGUE_SWATCHES.length]!;
    const a = lookAssetIds[i % lookAssetIds.length]!;
    const b = lookAssetIds[(i + 3) % lookAssetIds.length]!;
    const c = lookAssetIds[(i + 7) % lookAssetIds.length]!;
    const slug = `${look.houseTag.toLowerCase()}-${look.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

    if (publishedSlugs.has(slug)) {
      continue;
    }

    await createPublishedCatalogueDesign({
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
      leadTimeDaysOverride: 14,
      featured: Boolean(look.featured),
      tags: [
        { kind: "OCCASION", value: look.occasion },
        { kind: "SEASON", value: "SUMMER" },
        { kind: "WORK", value: look.work ?? "PLAIN" },
        { kind: "FREE", value: look.houseTag },
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
      placeholderAssetId: a,
      renderSpecs: [
        {
          colourwayIndex: 0,
          angle: "FRONT",
          assetId: a,
          altText: `${look.name} — front`,
          sortOrder: 0,
        },
        {
          colourwayIndex: 0,
          angle: "THREE_QUARTER",
          assetId: b,
          altText: `${look.name} — three-quarter`,
          sortOrder: 1,
        },
        {
          colourwayIndex: 0,
          angle: "BACK",
          assetId: c,
          altText: `${look.name} — back`,
          sortOrder: 2,
        },
        {
          colourwayIndex: 1,
          angle: "FRONT",
          assetId: b,
          altText: `${look.name} alt shade — front`,
          sortOrder: 3,
        },
      ],
      availableSizeLabels: STOREFRONT_RTW_SIZE_LABELS,
      actor: { id: owner.id, role: owner.role },
      auditNote: `Admin rebuild — ${look.houseTag} Pakistani East–West`,
    });
    published += 1;
    if (published <= 5 || published === HOUSE_CATALOGUE_LOOKS.length) {
      console.log(`✓ design ${look.name}`);
    } else if (published === 6) {
      console.log("  …");
    }
  }
  console.log(`✓ ${published} published designs`);

  // --- Homepage ---
  await seedContentDefaults();
  const heroPaths = heroFiles();
  const heroAssetIds: string[] = [];
  for (const fp of heroPaths.slice(0, 6)) {
    const body = fs.readFileSync(fp);
    const mime = fp.endsWith(".png") ? "image/png" : "image/jpeg";
    const { key } = await uploadBufferToR2({
      body,
      mime,
      keyPrefix: "aks-merch/hero",
    });
    try {
      saveLocalDevAsset(key, body);
    } catch {
      /* ok */
    }
    const asset = await completeUpload({
      key,
      mime,
      uploadedById: owner.id,
      kind: "IMAGE",
    });
    heroAssetIds.push(asset.id);
  }

  const homes = await db.select().from(homepages);
  for (const home of homes) {
    const slides = await db
      .select()
      .from(heroSlides)
      .where(eq(heroSlides.homepageId, home.id));
    for (const [si, slide] of slides.entries()) {
      const asset = heroAssetIds[si % heroAssetIds.length]!;
      await db
        .update(heroSlides)
        .set({
          desktopImageAssetId: asset,
          mobileImageAssetId: asset,
          updatedAt: new Date(),
        })
        .where(eq(heroSlides.id, slide.id));
    }
    const tiles = await db
      .select()
      .from(categoryTiles)
      .where(eq(categoryTiles.homepageId, home.id));
    for (const [ti, tile] of tiles.entries()) {
      await db
        .update(categoryTiles)
        .set({
          imageAssetId: heroAssetIds[(ti + 1) % heroAssetIds.length]!,
          updatedAt: new Date(),
        })
        .where(eq(categoryTiles.id, tile.id));
    }
  }
  console.log("✓ homepage hero + doors");

  const [counts] = await sql<
    { published: number; fabrics: number; renders: number }[]
  >`
    select
      (select count(*)::int from designs where status = 'PUBLISHED') as published,
      (select count(*)::int from fabrics where active) as fabrics,
      (select count(*)::int from design_renders) as renders`;
  console.log("\n=== VERIFY ===", counts);
  console.log("Browse http://localhost:3000/\n");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
