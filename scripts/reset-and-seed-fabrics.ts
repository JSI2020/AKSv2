import { config } from "dotenv";
import { spawnSync } from "node:child_process";

config({ path: ".env.local" });
config({ path: ".env" });

import {
  LAUNCH_FABRIC_CATALOG,
  metresToHundredths,
} from "./demo-fabric-catalog-data";

function run(label: string, args: string[]): void {
  console.log(`\n>>> ${label}\n`);
  const result = spawnSync("npx", ["tsx", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
}

/**
 * Wipe designs / orders / inventory / fabrics, restore sizing reference data,
 * regenerate 30 spiral-drape swatch photos, seed fabric catalogue + stock lots.
 *
 *   npm run db:reset:fabrics -- --confirm
 */
async function main() {
  const confirm = process.argv.includes("--confirm");
  if (!confirm) {
    console.error(
      "This deletes all designs, orders, inventory, and fabrics.\n\n  npm run db:reset:fabrics -- --confirm\n",
    );
    process.exit(1);
  }

  run("Wipe business data + bootstrap sizing reference", [
    "scripts/db-wipe-all-data.ts",
    "--confirm",
    "--bootstrap",
  ]);

  run("Download 30 real fabric photos (Pexels)", [
    "scripts/fetch-demo-fabric-photos.ts",
  ]);

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
  const { createHash } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const sharp = (await import("sharp")).default;
  const { ensureFabricColourways } = await import(
    "@/modules/inventory/ledger-queries"
  );
  const { refreshFabricLotStatus } = await import(
    "@/modules/inventory/lot-status"
  );

  async function upsertSwatchAsset(input: {
    body: Buffer;
    mime: string;
    r2Key: string;
    ownerId: string;
  }): Promise<string> {
    const { assets } = await import("@aks/db");
    const [existingAsset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.r2Key, input.r2Key))
      .limit(1);

    if (existingAsset) {
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
        /* public/ fallback */
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
      /* public/ fallback */
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

  const [owner] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.role, "OWNER"))
    .limit(1);
  if (!owner) throw new Error("No OWNER user after wipe");

  console.log(`\n>>> Seed ${LAUNCH_FABRIC_CATALOG.length} fabrics + stock lots\n`);

  let created = 0;
  for (const def of LAUNCH_FABRIC_CATALOG) {
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
    const fabricId = uuidv7();
    await db.insert(fabrics).values({
      id: fabricId,
      name: def.name,
      composition: def.composition,
      weightGsm: def.weightGsm,
      widthInches: def.widthInches,
      stretchPercent: def.stretchPercent,
      shrinkageAllowance: def.shrinkageAllowance,
      drapeClass: def.drapeClass,
      costPerMeterMinor: def.costPerMeterMinor,
      careInstructions: def.careInstructions,
      drapeNotes: def.drapeNotes,
      reorderPointMeters,
      reorderQuantityMeters: reorderPointMeters * 2,
      swatchAssetId,
      active: true,
    });

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

    const lotId = uuidv7();
    const metersHundredths = metresToHundredths(def.lotMetres);
    const lotCode = lotCodeFor(def.name);
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
    await ensureFabricColourways(fabricId);
    created += 1;
    console.log(`  ${def.name} — ${def.lotMetres}m`);
  }

  const counts = await sql<
    {
      fabrics: number;
      lots: number;
      designs: number;
      orders: number;
    }[]
  >`
    select
      (select count(*)::int from fabrics) as fabrics,
      (select count(*)::int from fabric_lots) as lots,
      (select count(*)::int from designs) as designs,
      (select count(*)::int from orders) as orders`;

  console.log("\n=== After reset ===");
  console.log(counts[0]);
  console.log(`\nSeeded ${created} fabrics with spiral-drape swatch photos.`);
  console.log("Admin: /admin/fabrics · /admin/inventory/fabrics\n");

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
