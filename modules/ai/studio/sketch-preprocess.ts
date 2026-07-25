import sharp from "sharp";

export type SketchPreprocessResult = {
  /** Deskewed, cropped, contrast-boosted PNG. */
  processed: Buffer;
  /** Lineart derivative for ControlNet / storefront reveal. */
  lineart: Buffer;
};

const LAPLACIAN_KERNEL = {
  width: 3,
  height: 3,
  kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0],
};

/** Estimate skew angle (-5° … +5°) via horizontal ink projection. */
async function estimateSkewAngle(source: Buffer): Promise<number> {
  const meta = await sharp(source).metadata();
  const width = Math.min(meta.width ?? 512, 512);
  const height = Math.min(meta.height ?? 512, 512);

  let bestAngle = 0;
  let bestScore = -1;

  for (let angle = -5; angle <= 5; angle += 1) {
    const { data, info } = await sharp(source)
      .rotate(angle, { background: { r: 255, g: 255, b: 255 } })
      .resize(width, height, { fit: "inside" })
      .greyscale()
      .threshold(220)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rowSums = new Array(info.height).fill(0);
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[y * info.width + x] === 0) rowSums[y] += 1;
      }
    }

    const mean = rowSums.reduce((a, b) => a + b, 0) / rowSums.length;
    const variance =
      rowSums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / rowSums.length;

    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

/**
 * Deskew → crop to drawing → contrast boost → lineart derivative.
 * Uses sharp only; derivative is high-contrast edge lineart.
 */
export async function preprocessSketch(
  input: Buffer,
): Promise<SketchPreprocessResult> {
  const oriented = await sharp(input).rotate().toBuffer();
  const skewAngle = await estimateSkewAngle(oriented);

  const deskewed = await sharp(oriented)
    .rotate(skewAngle, { background: { r: 255, g: 255, b: 255 } })
    .trim({ threshold: 15, background: "#ffffff" })
    .toBuffer();

  const processed = await sharp(deskewed)
    .normalize()
    .linear(1.25, -32)
    .sharpen()
    .png()
    .toBuffer();

  const lineart = await sharp(processed)
    .greyscale()
    .convolve(LAPLACIAN_KERNEL)
    .normalize()
    .threshold(128)
    .negate()
    .png()
    .toBuffer();

  return { processed, lineart };
}
