import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
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

function isLocalDevStorage(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const endpoint = process.env.R2_ENDPOINT ?? "";
  return /127\.0\.0\.1|localhost/.test(endpoint);
}

function localAssetPath(key: string): string {
  return join(process.cwd(), "public", key.replace(/^\/+/, ""));
}

function writeLocalAsset(key: string, body: Buffer): void {
  const filePath = localAssetPath(key);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, body);
}

function readLocalAsset(key: string): Buffer | null {
  const filePath = localAssetPath(key);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath);
}

function localUploadUrl(key: string): string {
  const base =
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}/api/assets/local-upload?key=${encodeURIComponent(key)}`;
}

function mimeExtension(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

function localPublicAssetUrl(key: string): string | null {
  if (!readLocalAsset(key)) return null;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}/api/assets/serve?key=${encodeURIComponent(key)}`;
}

/** Dev-only: persist upload bytes when MinIO/R2 is offline. */
export function saveLocalDevAsset(key: string, body: Buffer): void {
  if (!isLocalDevStorage()) {
    throw new Error("Local asset storage is only available in development");
  }
  writeLocalAsset(key, body);
}

export async function createPresignedUploadUrl(input: {
  key?: string;
  contentType: string;
  expiresInSeconds?: number;
  /** Required for new keys — binds object to user or anon namespace. */
  keyPrefix?: string;
}): Promise<{ url: string; key: string }> {
  const key =
    input.key ??
    `${input.keyPrefix ?? "uploads/unscoped"}/${uuidv7()}${mimeExtension(input.contentType)}`;

  if (isLocalDevStorage()) {
    try {
      const client = createR2Client();
      await client.send(new HeadBucketCommand({ Bucket: getBucket() }));
      const command = new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ContentType: input.contentType,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: input.expiresInSeconds ?? 600,
      });
      return { url, key };
    } catch {
      return { url: localUploadUrl(key), key };
    }
  }

  const client = createR2Client();
  await ensureBucket(client);
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

/** True when `key` is under an allowed ownership prefix. */
export function uploadKeyOwnedByPrefix(
  key: string,
  allowedPrefixes: string[],
): boolean {
  const normalized = key.replace(/^\/+/, "");
  return allowedPrefixes.some(
    (prefix) =>
      normalized === prefix.replace(/\/$/, "") ||
      normalized.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
  );
}

export async function createPresignedReadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const localUrl = localPublicAssetUrl(key);
  if (localUrl) return localUrl;

  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

function guessMimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Ensure bytes exist in R2 — mirror from public/ when MinIO was offline at upload. */
export async function ensureObjectInR2(key: string): Promise<void> {
  const client = createR2Client();
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
    );
    return;
  } catch {
    // not in R2 yet
  }

  const local = readLocalAsset(key);
  if (!local) {
    throw new Error(
      "Reference photo not found in storage. Re-upload the FRONT reference and try again.",
    );
  }

  try {
    await ensureBucket(client);
    await client.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: local,
        ContentType: guessMimeFromKey(key),
      }),
    );
  } catch {
    throw new Error(
      "Object storage (R2/MinIO) is not reachable. Run: docker compose up -d minio minio-init — then set R2_ENDPOINT=http://127.0.0.1:9010 in .env.local.",
    );
  }
}

/**
 * URL for external AI providers (fal.ai). Never returns localhost — fal must fetch the image.
 */
export async function createAiExternalReadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  if (process.env.AI_GENERATION_MOCK === "1") {
    return createPresignedReadUrl(key, expiresInSeconds);
  }

  await ensureObjectInR2(key);
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(key: string): Promise<void> {
  const filePath = localAssetPath(key);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    return;
  }
  const client = createR2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const local = readLocalAsset(key);
  if (local) return local;

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
  const key = `${input.keyPrefix ?? "uploads"}/${uuidv7()}.jpg`;
  if (isLocalDevStorage()) {
    try {
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
    } catch {
      writeLocalAsset(key, input.body);
      return { key };
    }
  }

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
