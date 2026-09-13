import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

import sharp from "sharp";

import { LAUNCH_FABRIC_CATALOG } from "./demo-fabric-catalog-data";
import {
  DEMO_FABRIC_PHOTO_SOURCES,
  pexelsDownloadUrl,
} from "./demo-fabric-photo-sources";

/** Download real Pexels photos + set PKR 150–400/m on existing launch fabrics. */
async function main() {
  const { uuidv7 } = await import("@aks/shared");
  const {
    db,
    assets,
    fabricLots,
    fabrics,
    sql,
    users,
  } = await import("@aks/db");
  const { eq } = await import("drizzle-orm");

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER user");

  console.log(`\nRefreshing ${LAUNCH_FABRIC_CATALOG.length} fabrics…\n`);

  for (const def of LAUNCH_FABRIC_CATALOG) {
    const localPath = join(process.cwd(), "public/fabrics/demo", def.file);
    const source = DEMO_FABRIC_PHOTO_SOURCES[def.file];
    let jpeg: Buffer;
    if (source) {
      const res = await fetch(pexelsDownloadUrl(source.pexelsId, 1200), {
        headers: { "User-Agent": "AKS-demo-seed/1.0" },
      });
      if (!res.ok) {
        throw new Error(`Pexels ${source.pexelsId} HTTP ${res.status} for ${def.file}`);
      }
      const raw = Buffer.from(await res.arrayBuffer());
      jpeg = await sharp(raw)
        .resize(512, 512, { fit: "cover", position: "centre" })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { dirname } = await import("node:path");
      mkdirSync(dirname(localPath), { recursive: true });
      writeFileSync(localPath, jpeg);
    } else {
      jpeg = readFileSync(localPath);
    }
    const r2Key = `fabrics/demo/${def.file}`;

    const [existingAsset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.r2Key, r2Key))
      .limit(1);

    const meta = await sharp(jpeg).metadata();
    let swatchAssetId: string;

    if (existingAsset) {
      swatchAssetId = existingAsset.id;
      await db
        .update(assets)
        .set({
          mime: "image/jpeg",
          width: meta.width ?? null,
          height: meta.height ?? null,
          bytes: jpeg.byteLength,
          sha256: createHash("sha256").update(jpeg).digest("hex"),
          updatedAt: new Date(),
        })
        .where(eq(assets.id, swatchAssetId));

      try {
        const { createR2Client, getBucket, ensureBucket } = await import(
          "@/modules/platform/assets"
        );
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
        const client = createR2Client();
        await ensureBucket(client);
        await client.send(
          new PutObjectCommand({
            Bucket: getBucket(),
            Key: r2Key,
            Body: jpeg,
            ContentType: "image/jpeg",
          }),
        );
      } catch {
        /* public/ fallback */
      }
    } else {
      swatchAssetId = uuidv7();
      await db.insert(assets).values({
        id: swatchAssetId,
        r2Key,
        mime: "image/jpeg",
        width: meta.width ?? null,
        height: meta.height ?? null,
        bytes: jpeg.byteLength,
        sha256: createHash("sha256").update(jpeg).digest("hex"),
        kind: "IMAGE",
        uploadedById: owner.id,
        isAiGenerated: false,
      });
    }

    const [fabric] = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(eq(fabrics.name, def.name))
      .limit(1);

    if (!fabric) {
      console.log(`  SKIP  ${def.name} — not in database`);
      continue;
    }

    await db
      .update(fabrics)
      .set({
        swatchAssetId,
        costPerMeterMinor: def.costPerMeterMinor,
        updatedAt: new Date(),
      })
      .where(eq(fabrics.id, fabric.id));

    await db
      .update(fabricLots)
      .set({
        costPerMeterMinor: def.costPerMeterMinor,
        updatedAt: new Date(),
      })
      .where(eq(fabricLots.fabricId, fabric.id));

    const { ensureFabricColourways, syncFabricColourwaySwatches } =
      await import("@/modules/inventory/ledger-queries");
    await ensureFabricColourways(fabric.id);
    await syncFabricColourwaySwatches(fabric.id);

    const pkr = def.costPerMeterMinor / 100;
    console.log(`  ${def.name} — PKR ${pkr}/m · swatch refreshed`);
  }

  await sql.end({ timeout: 5 });
  console.log("\nDone. Hard-refresh /admin/fabrics to see updates.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
