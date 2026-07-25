import { GetObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

import { assets, db, designGenerations } from "@aks/db";

import { createR2Client, getBucket } from "@/modules/platform/assets/r2";

import { detectModelPixelHeight } from "./detect-model-height";

async function readAssetBuffer(assetId: string): Promise<Buffer> {
  const [asset] = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!asset) throw new Error("Asset not found");

  const client = createR2Client();
  const response = await client.send(
    new GetObjectCommand({ Bucket: getBucket(), Key: asset.r2Key }),
  );
  const body = response.Body;
  if (!body) throw new Error("Empty asset body");
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function calibrateGenerationOutput(
  generationId: string,
  outputAssetId: string,
  storedModelPixelHeight?: number | null,
) {
  const buffer = await readAssetBuffer(outputAssetId);
  const calibration = await detectModelPixelHeight(
    buffer,
    storedModelPixelHeight,
  );

  await db
    .update(designGenerations)
    .set({
      outputMeta: {
        imageWidthPx: calibration.imageWidthPx,
        imageHeightPx: calibration.imageHeightPx,
        modelPixelHeight: calibration.modelPixelHeight,
        modelHeightDetection: calibration.modelHeightDetection,
      },
    })
    .where(eq(designGenerations.id, generationId));

  return calibration;
}
