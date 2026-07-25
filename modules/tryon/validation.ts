import { createHash } from "crypto";
import sharp, { type Metadata } from "sharp";

import { getImageGenProvider } from "@/modules/ai/providers";
import { createPresignedReadUrl, getObjectBytes } from "@/modules/platform/assets";

import type { SelfieValidationResult } from "./types";
import { SELFIE_MIN_EDGE_PX } from "./types";

const BLUR_VARIANCE_THRESHOLD = 80;

function guidanceForKind(
  kind: Exclude<SelfieValidationResult, { ok: true }>["kind"],
): string {
  switch (kind) {
    case "NO_FACE":
      return "We need to see your whole face — try facing a window.";
    case "MULTIPLE_FACES":
      return "Please upload a photo with just you in frame.";
    case "LOW_RESOLUTION":
      return "Your photo is too small — use the front camera at arm's length.";
    case "BLURRY":
      return "The photo looks blurry — hold still and try again in good light.";
    case "NSFW":
      return "This photo can't be used for Reflection.";
    case "INVALID_IMAGE":
      return "We couldn't read that image — try a JPG or PNG.";
  }
}

/** Laplacian variance blur heuristic on centre crop (face region proxy). */
async function blurVariance(body: Buffer): Promise<number> {
  const { data, info } = await sharp(body)
    .resize(256, 256, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const idx = y * w + x;
      const lap =
        -4 * data[idx]! +
        data[idx - 1]! +
        data[idx + 1]! +
        data[idx - w]! +
        data[idx + w]!;
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * Face count heuristic: centre-weighted skin-tone cluster.
 * Mock mode always passes with sha256-based embedding ref.
 */
async function detectFaceCount(body: Buffer): Promise<number> {
  if (process.env.AI_GENERATION_MOCK === "1") {
    return 1;
  }

  const { data, info } = await sharp(body)
    .resize(128, 128, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cx = info.width / 2;
  const cy = info.height / 2;
  const radius = Math.min(info.width, info.height) * 0.35;
  let skinPixels = 0;
  let total = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > radius * radius) continue;
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      total += 1;
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
        skinPixels += 1;
      }
    }
  }

  if (total === 0) return 0;
  const ratio = skinPixels / total;
  if (ratio < 0.08) return 0;
  if (ratio > 0.45) return 2;
  return 1;
}

export function computeFaceEmbeddingRef(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export async function validateSelfieAsset(input: {
  assetId: string;
  r2Key: string;
}): Promise<SelfieValidationResult> {
  let body: Buffer;
  try {
    body = await getObjectBytes(input.r2Key);
  } catch {
    return {
      ok: false,
      kind: "INVALID_IMAGE",
      message: guidanceForKind("INVALID_IMAGE"),
    };
  }

  let meta: Metadata;
  try {
    meta = await sharp(body).metadata();
  } catch {
    return {
      ok: false,
      kind: "INVALID_IMAGE",
      message: guidanceForKind("INVALID_IMAGE"),
    };
  }

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < SELFIE_MIN_EDGE_PX || h < SELFIE_MIN_EDGE_PX) {
    return {
      ok: false,
      kind: "LOW_RESOLUTION",
      message: guidanceForKind("LOW_RESOLUTION"),
    };
  }

  const variance = await blurVariance(body);
  if (variance < BLUR_VARIANCE_THRESHOLD) {
    return {
      ok: false,
      kind: "BLURRY",
      message: guidanceForKind("BLURRY"),
    };
  }

  const faceCount = await detectFaceCount(body);
  if (faceCount === 0) {
    return {
      ok: false,
      kind: "NO_FACE",
      message: guidanceForKind("NO_FACE"),
    };
  }
  if (faceCount > 1) {
    return {
      ok: false,
      kind: "MULTIPLE_FACES",
      message: guidanceForKind("MULTIPLE_FACES"),
    };
  }

  try {
    const readUrl = await createPresignedReadUrl(input.r2Key, 600);
    const moderation = await getImageGenProvider().moderate({ imageUrl: readUrl });
    if (!moderation.safe) {
      return {
        ok: false,
        kind: "NSFW",
        message: guidanceForKind("NSFW"),
      };
    }
  } catch {
    if (process.env.AI_GENERATION_MOCK !== "1") {
      return {
        ok: false,
        kind: "NSFW",
        message: guidanceForKind("NSFW"),
      };
    }
  }

  return { ok: true, faceEmbeddingRef: computeFaceEmbeddingRef(body) };
}
