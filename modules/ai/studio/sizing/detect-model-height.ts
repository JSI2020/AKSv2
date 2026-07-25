import sharp from "sharp";

/** Fallback when trim/bbox detection fails — documented studio default. */
export const MODEL_HEIGHT_FALLBACK_FRACTION_BP = 8800;

export type ModelHeightDetection = "sharp_bbox" | "stored" | "fallback_fraction";

export type ModelHeightCalibration = {
  imageWidthPx: number;
  imageHeightPx: number;
  modelPixelHeight: number;
  modelHeightDetection: ModelHeightDetection;
};

function fallbackHeight(imageHeightPx: number): ModelHeightCalibration {
  const modelPixelHeight = Math.round(
    (imageHeightPx * MODEL_HEIGHT_FALLBACK_FRACTION_BP) / 10_000,
  );
  return {
    imageWidthPx: 0,
    imageHeightPx,
    modelPixelHeight,
    modelHeightDetection: "fallback_fraction",
  };
}

/**
 * Detect subject pixel height on a locked hero render.
 * Uses sharp trim on a near-white studio backdrop; falls back to 88% of frame height.
 */
export async function detectModelPixelHeight(
  imageBuffer: Buffer,
  storedModelPixelHeight?: number | null,
): Promise<ModelHeightCalibration> {
  const oriented = await sharp(imageBuffer).rotate().toBuffer();
  const meta = await sharp(oriented).metadata();
  const imageWidthPx = meta.width ?? 0;
  const imageHeightPx = meta.height ?? 0;

  if (storedModelPixelHeight != null && storedModelPixelHeight > 0) {
    return {
      imageWidthPx,
      imageHeightPx,
      modelPixelHeight: storedModelPixelHeight,
      modelHeightDetection: "stored",
    };
  }

  if (imageHeightPx <= 0) {
    return {
      imageWidthPx,
      imageHeightPx,
      modelPixelHeight: 0,
      modelHeightDetection: "fallback_fraction",
    };
  }

  try {
    const trimmed = await sharp(oriented)
      .trim({ threshold: 12 })
      .toBuffer({ resolveWithObject: true });

    const trimmedHeight = trimmed.info.height;
    if (trimmedHeight > 0 && trimmedHeight <= imageHeightPx) {
      return {
        imageWidthPx: trimmed.info.width,
        imageHeightPx,
        modelPixelHeight: trimmedHeight,
        modelHeightDetection: "sharp_bbox",
      };
    }
  } catch {
    // trim can fail on busy backgrounds — use documented fallback
  }

  const fb = fallbackHeight(imageHeightPx);
  return { ...fb, imageWidthPx };
}

export function pixelsPerInch(
  modelPixelHeight: number,
  archetypeHeightInches: number,
): number {
  if (modelPixelHeight <= 0 || archetypeHeightInches <= 0) return 0;
  return modelPixelHeight / (archetypeHeightInches / 100);
}
