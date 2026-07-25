import { createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

import { db } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  completeUpload,
  createR2Client,
  ensureBucket,
  getBucket,
} from "@/modules/platform/assets";

import { MOCK_PNG_BASE64 } from "../providers/mock";

export async function persistGenerationImage(input: {
  generationId: string;
  imageUrl: string;
}): Promise<string> {
  let body: Buffer;
  let mime = "image/png";

  if (input.imageUrl.startsWith("data:")) {
    const base64 = input.imageUrl.split(",")[1]?.split("#")[0] ?? MOCK_PNG_BASE64;
    body = Buffer.from(base64, "base64");
  } else {
    const res = await fetch(input.imageUrl);
    if (!res.ok) {
      throw new Error(`Failed to download generation image: ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    body = Buffer.from(arrayBuffer);
    mime = res.headers.get("content-type") ?? "image/png";
  }

  const key = `generations/${input.generationId}.png`;
  const client = createR2Client();
  await ensureBucket(client);
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: mime,
    }),
  );

  const asset = await completeUpload({
    key,
    mime,
    isAiGenerated: true,
  });
  return asset.id;
}

export async function verifyAssetInDb(assetId: string): Promise<boolean> {
  const { assets } = await import("@aks/db");
  const [row] = await db
    .select({ id: assets.id, sha256: assets.sha256 })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  return Boolean(row?.id);
}

export function sha256OfMockPng(): string {
  return createHash("sha256")
    .update(Buffer.from(MOCK_PNG_BASE64, "base64"))
    .digest("hex");
}

/** Direct mock persist without network — for tests when R2 env is set. */
export async function persistMockGenerationImage(
  generationId: string,
): Promise<string> {
  return persistGenerationImage({
    generationId,
    imageUrl: `data:image/png;base64,${MOCK_PNG_BASE64}`,
  });
}

export { uuidv7 };
