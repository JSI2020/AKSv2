import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "crypto";
import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import sharp from "sharp";

import { assets, db } from "@aks/db";
import { uuidv7 } from "@aks/shared";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function createR2Client(): S3Client {
  const endpoint = requireEnv("R2_ENDPOINT");
  return new S3Client({
    region: process.env.R2_REGION ?? "auto",
    endpoint,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });
}

export function getBucket(): string {
  return requireEnv("R2_BUCKET");
}

export async function ensureBucket(client = createR2Client()): Promise<void> {
  const bucket = getBucket();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function createPresignedUploadUrl(input: {
  key?: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{ url: string; key: string }> {
  const client = createR2Client();
  await ensureBucket(client);
  const key = input.key ?? `uploads/${uuidv7()}`;
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: input.contentType,
  });
  const url = await getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 600,
  });
  return { url, key };
}

export async function createPresignedReadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(key: string): Promise<void> {
  const client = createR2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const client = createR2Client();
  const res = await client.send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
  );
  const stream = res.Body;
  if (!stream) throw new Error("Empty object body");
  const bytes = await stream.transformToByteArray();
  return Buffer.from(bytes);
}

export type CompleteUploadInput = {
  key: string;
  mime: string;
  uploadedById?: string;
  kind?: "IMAGE" | "VIDEO" | "DOCUMENT" | "OTHER";
  isAiGenerated?: boolean;
  purgeAt?: Date | null;
};

export async function uploadBufferToR2(input: {
  body: Buffer;
  mime: string;
  keyPrefix?: string;
}): Promise<{ key: string }> {
  const key = `${input.keyPrefix ?? "uploads"}/${uuidv7()}`;
  const client = createR2Client();
  await ensureBucket(client);
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: input.body,
      ContentType: input.mime,
    }),
  );
  return { key };
}

export async function completeUpload(input: CompleteUploadInput) {
  const body = await getObjectBytes(input.key);
  const sha256 = createHash("sha256").update(body).digest("hex");
  let width: number | null = null;
  let height: number | null = null;
  let kind = input.kind ?? "OTHER";

  if (input.mime.startsWith("image/")) {
    kind = input.kind ?? "IMAGE";
    try {
      const meta = await sharp(body).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      // non-decodable image — keep null dimensions
    }
  }

  const id = uuidv7();
  await db.insert(assets).values({
    id,
    r2Key: input.key,
    mime: input.mime,
    width,
    height,
    bytes: body.byteLength,
    sha256,
    kind,
    uploadedById: input.uploadedById ?? null,
    isAiGenerated: input.isAiGenerated ?? false,
    purgeAt: input.purgeAt ?? null,
  });

  return {
    id,
    r2Key: input.key,
    mime: input.mime,
    width,
    height,
    bytes: body.byteLength,
    sha256,
    kind,
  };
}

export async function deleteAsset(assetId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!row) return;
  await deleteObject(row.r2Key);
  await db.delete(assets).where(eq(assets.id, assetId));
}

/** Worker handler: hard-delete objects past purgeAt. */
export async function purgeExpiredAssets(): Promise<number> {
  const now = new Date();
  const expired = await db
    .select()
    .from(assets)
    .where(
      and(
        isNotNull(assets.purgeAt),
        lte(assets.purgeAt, now),
        isNull(assets.purgedAt),
      ),
    );

  let count = 0;
  for (const row of expired) {
    try {
      await deleteObject(row.r2Key);
      await db
        .update(assets)
        .set({ purgedAt: now, updatedAt: now })
        .where(eq(assets.id, row.id));
      count += 1;
    } catch (err) {
      console.error("[purgeExpiredAssets]", row.id, err);
    }
  }
  return count;
}
