import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

import sharp from "sharp";

import {
  DEMO_FABRIC_CATALOG,
  metresToHundredths,
} from "./demo-fabric-catalog-data";
import { ensureDemoSwatchFile } from "./demo-swatch-image";

async function upsertSwatchAsset(input: {
  body: Buffer;
  mime: string;
  r2Key: string;
  ownerId: string;
}): Promise<string> {
  const { db, assets } = await import("@aks/db");
  const { eq } = await import("drizzle-orm");
  const { uuidv7 } = await import("@aks/shared");

  const [existingAsset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.r2Key, input.r2Key))
    .limit(1);

  if (existingAsset) {
    const { createR2Client, getBucket, ensureBucket } = await import(
      "@/modules/platform/assets"
    );
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const client = createR2Client();
      await ensureBucket(client);
      await client.send(
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: input.r2Key,
          Body: input.body,
          ContentType: input.mime,
        }),
      );
    } catch {
      // R2 offline — public/ mirror serves via createPresignedReadUrl fallback
    }
    return existingAsset.id;
  }

  const meta = await sharp(input.body).metadata();
  const id = uuidv7();
  await db.insert(assets).values({
    id,
    r2Key: input.r2Key,
    mime: input.mime,
    width: meta.width ?? null,
    height: meta.height ?? null,
    bytes: input.body.byteLength,
    sha256: createHash("sha256").update(input.body).digest("hex"),
    kind: "IMAGE",
    uploadedById: input.ownerId,
    isAiGenerated: false,
  });

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
        Key: input.r2Key,
        Body: input.body,
        ContentType: input.mime,
      }),
    );
  } catch {
    // served from public/ when R2 is offline
  }

  return id;
}

function lotCodeFor(name: string): string {
  const slug = name
    .replace(/^Demo\s+/i, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);
  return `DEMO-${slug}-1`;
}

/**
 * Seed Demo fabrics with swatch photos, stock lots, and inventory colourways.
 * Run: npm run db:seed:fabrics
 */
async function main() {
  const { uuidv7 } = await import("@aks/shared");
  const {
    db,
    fabricLots,
    fabrics,
    insertAuditLog,
    sql,
    stockAdjustments,
    users,
  } = await import("@aks/db");
  const { eq } = await import("drizzle-orm");
  const { ensureFabricColourways } = await import(
    "@/modules/inventory/ledger-queries"
  );
  const { refreshFabricLotStatus } = await import(
    "@/modules/inventory/lot-status"
  );

  const [owner] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER user — run db:post-wipe first");

  console.log("\n=== Seed Demo fabrics (swatches + stock lots) ===\n");
  console.log(`Catalogue: ${DEMO_FABRIC_CATALOG.length} fabrics\n`);

  let created = 0;
  let lotsCreated = 0;
  let lotsUpdated = 0;

  for (const def of DEMO_FABRIC_CATALOG) {
    await ensureDemoSwatchFile({
      file: def.file,
      hex: def.hex,
      texture: def.texture,
    });

    const localPath = join(process.cwd(), "public/fabrics/demo", def.file);
    const jpeg = readFileSync(localPath);
    const r2Key = `fabrics/demo/${def.file}`;
    const swatchAssetId = await upsertSwatchAsset({
      body: jpeg,
      mime: "image/jpeg",
      r2Key,
      ownerId: owner.id,
    });

    const reorderPointMeters = metresToHundredths(def.reorderMetres);
    const values = {
      composition: def.composition,
      weightGsm: def.weightGsm,
      widthInches: def.widthInches,
      stretchPercent: def.stretchPercent,
      shrinkageAllowance: def.shrinkageAllowance,
      drapeClass: def.drapeClass,
      costPerMeterMinor: def.costPerMeterMinor,
      careInstructions: def.careInstructions,
      drapeNotes: `${def.drapeNotes} Use: ${def.garmentUse}.`,
      reorderPointMeters,
      reorderQuantityMeters: reorderPointMeters * 2,
      swatchAssetId,
      active: true,
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(eq(fabrics.name, def.name))
      .limit(1);

    let fabricId: string;
    if (existing) {
      fabricId = existing.id;
      await db.update(fabrics).set(values).where(eq(fabrics.id, fabricId));
    } else {
      fabricId = uuidv7();
      await db.insert(fabrics).values({ id: fabricId, name: def.name, ...values });
      await insertAuditLog(db, {
        id: uuidv7(),
        actorId: owner.id,
        actorRole: owner.role,
        action: "fabric.create",
        entityType: "fabric",
        entityId: fabricId,
        before: null,
        after: { name: def.name, swatchAssetId },
      });
      created += 1;
    }

    const lotCode = lotCodeFor(def.name);
    const metersHundredths = metresToHundredths(def.lotMetres);
    const [existingLot] = await db
      .select({ id: fabricLots.id })
      .from(fabricLots)
      .where(eq(fabricLots.lotCode, lotCode))
      .limit(1);

    if (existingLot) {
      const [prev] = await db
        .select({
          metersOnHand: fabricLots.metersOnHand,
          metersReceived: fabricLots.metersReceived,
        })
        .from(fabricLots)
        .where(eq(fabricLots.id, existingLot.id))
        .limit(1);
      const delta = metersHundredths - (prev?.metersOnHand ?? 0);
      await db
        .update(fabricLots)
        .set({
          metersReceived: metersHundredths,
          metersOnHand: metersHundredths,
          metersReserved: 0,
          costPerMeterMinor: def.costPerMeterMinor,
          colourNotes: "Default",
          status: "AVAILABLE",
          updatedAt: new Date(),
        })
        .where(eq(fabricLots.id, existingLot.id));
      await refreshFabricLotStatus(db as never, existingLot.id);
      if (delta !== 0) {
        await db.insert(stockAdjustments).values({
          id: uuidv7(),
          fabricLotId: existingLot.id,
          deltaMeters: delta,
          reason: "OTHER",
          note: `Stock sync — lot ${lotCode}`,
          actorId: owner.id,
        });
      }
      lotsUpdated += 1;
    } else {
      const lotId = uuidv7();
      await db.insert(fabricLots).values({
        id: lotId,
        fabricId,
        lotCode,
        colourNotes: "Default",
        metersReceived: metersHundredths,
        metersOnHand: metersHundredths,
        metersReserved: 0,
        costPerMeterMinor: def.costPerMeterMinor,
        receivedAt: new Date(),
        status: "AVAILABLE",
      });
      await refreshFabricLotStatus(db as never, lotId);
      await db.insert(stockAdjustments).values({
        id: uuidv7(),
        fabricLotId: lotId,
        deltaMeters: metersHundredths,
        reason: "OTHER",
        note: `Received — lot ${lotCode}`,
        actorId: owner.id,
      });
      lotsCreated += 1;
    }

    await ensureFabricColourways(fabricId);

    const low =
      metresToHundredths(def.lotMetres) <= reorderPointMeters ? " LOW" : "";
    console.log(
      `  ${def.name} — ${def.lotMetres}m on hand${low} · ${def.garmentUse.split(",")[0]}`,
    );
  }

  const countRows = await sql<{ n: number }[]>`
    select count(*)::int as n from fabrics where active and name like 'Demo %'`;
  const n = countRows[0]?.n ?? 0;

  console.log(
    `\nDone: ${created} new fabrics, ${lotsCreated} lots created, ${lotsUpdated} lots refreshed.`,
  );
  console.log(`${n} active Demo fabrics. Admin: /admin/fabrics · /admin/inventory/fabrics\n`);

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
