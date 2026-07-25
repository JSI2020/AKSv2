import { config } from "dotenv";
import { createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const { createR2Client, ensureBucket, getBucket, completeUpload, createPresignedReadUrl } =
    await import("./r2");
  const { assets, db, sql } = await import("@aks/db");

  // 1x1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const expectedSha = createHash("sha256").update(png).digest("hex");
  const key = `test/${Date.now()}.png`;

  const client = createR2Client();
  await ensureBucket(client);
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: png,
      ContentType: "image/png",
    }),
  );

  const asset = await completeUpload({ key, mime: "image/png" });
  if (asset.sha256 !== expectedSha) {
    throw new Error(`sha mismatch: ${asset.sha256} !== ${expectedSha}`);
  }

  const readUrl = await createPresignedReadUrl(asset.r2Key, 120);
  const res = await fetch(readUrl);
  if (!res.ok) throw new Error(`signed read failed: ${res.status}`);
  const got = Buffer.from(await res.arrayBuffer());
  const gotSha = createHash("sha256").update(got).digest("hex");
  if (gotSha !== expectedSha) throw new Error("downloaded bytes sha mismatch");

  const [row] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, asset.id))
    .limit(1);

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: asset.id,
        sha256: asset.sha256,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        rowSha: row?.sha256,
        readUrlHost: new URL(readUrl).host,
      },
      null,
      2,
    ),
  );

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
