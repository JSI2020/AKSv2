/**
 * Replace demo design photos only — keeps designs, costing, inventory intact.
 * Pulls from Chinese / regional boutiques (not famous PK labels).
 *
 * Run: npx tsx scripts/refresh-demo-design-photos.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import sharp from "sharp";

import {
  downloadDesignPhoto,
  fetchBoutiquePhotoCatalog,
  photoTripletForDesign,
  type DesignPhotoCatalog,
} from "./demo-design-photo-sources";
import type { CatalogueLook } from "../packages/db/house-catalogue-looks";

async function downloadAndResize(url: string): Promise<Buffer> {
  const raw = await downloadDesignPhoto(url);
  return sharp(raw)
    .resize(1200, 1600, { fit: "cover", position: "centre" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

function categoryFromComponents(
  components: string[] | null,
): CatalogueLook["category"] {
  const key = (components?.[0] ?? "KAMEEZ").toUpperCase();
  if (
    key === "TROUSER" ||
    key === "DUPATTA" ||
    key === "GOWN" ||
    key === "SKIRT"
  ) {
    return key;
  }
  return "KAMEEZ";
}

async function main() {
  const { and, asc, eq, like, inArray } = await import("drizzle-orm");
  const {
    colourways,
    db,
    designRenders,
    designs,
    sql,
    users,
  } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");
  const { completeUpload, uploadBufferToR2 } = await import(
    "@/modules/platform/assets/r2"
  );

  console.log("\n=== Refresh demo design photos (CN / regional boutiques) ===\n");

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER");

  console.log("Fetching boutique catalogues…");
  const catalog: DesignPhotoCatalog = await fetchBoutiquePhotoCatalog();
  for (const [cat, pool] of catalog.entries()) {
    console.log(`  ${cat}: ${pool.length}`);
  }

  const demoRows = await db
    .select({
      id: designs.id,
      slug: designs.slug,
      name: designs.name,
      components: designs.components,
    })
    .from(designs)
    .where(like(designs.slug, "demo-%"));

  if (!demoRows.length) {
    console.log("No demo-* designs found.");
    await sql.end({ timeout: 5 });
    return;
  }

  let updated = 0;
  for (const [i, d] of demoRows.entries()) {
    const category = categoryFromComponents(d.components);
    const triplet = photoTripletForDesign(i, category, catalog);
    const angles = ["FRONT", "THREE_QUARTER", "BACK"] as const;

    const cws = await db
      .select({ id: colourways.id, name: colourways.name, isDefault: colourways.isDefault })
      .from(colourways)
      .where(and(eq(colourways.designId, d.id), eq(colourways.active, true)))
      .orderBy(asc(colourways.sortOrder));
    if (!cws.length) continue;

    const defaultCw = cws.find((c) => c.isDefault) ?? cws[0]!;
    const altCw = cws.find((c) => c.id !== defaultCw.id) ?? defaultCw;

    const assetIds: string[] = [];
    for (const url of triplet.urls) {
      const jpeg = await downloadAndResize(url);
      const { key } = await uploadBufferToR2({
        body: jpeg,
        mime: "image/jpeg",
        keyPrefix: `designs/demo/${d.slug}`,
      });
      const asset = await completeUpload({
        key,
        mime: "image/jpeg",
        uploadedById: owner.id,
        kind: "IMAGE",
      });
      assetIds.push(asset.id);
    }

    await db
      .delete(designRenders)
      .where(eq(designRenders.designId, d.id));

    const renderRows = [
      ...angles.map((angle, idx) => ({
        id: uuidv7(),
        designId: d.id,
        colourwayId: defaultCw.id,
        angle,
        archetypeId: null,
        assetId: assetIds[idx]!,
        isAiGenerated: false,
        altText: `${d.name} in ${defaultCw.name}, ${angle.toLowerCase().replace(/_/g, " ")} view`,
        sortOrder: idx,
      })),
      {
        id: uuidv7(),
        designId: d.id,
        colourwayId: altCw.id,
        angle: "FRONT" as const,
        archetypeId: null,
        assetId: assetIds[1]!,
        isAiGenerated: false,
        altText: `${d.name} in ${altCw.name}, front view`,
        sortOrder: 3,
      },
    ];
    await db.insert(designRenders).values(renderRows);

    updated += 1;
    console.log(
      `  ✓ ${d.slug} ← ${triplet.productTitle.slice(0, 48)}… (${triplet.credit})`,
    );
  }

  console.log(`\nUpdated photos on ${updated} demo design(s).\n`);
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
