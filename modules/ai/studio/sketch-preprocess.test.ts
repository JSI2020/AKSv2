import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { preprocessSketch } from "./sketch-preprocess";

async function sketchFixture(): Promise<Buffer> {
  return sharp({
    create: {
      width: 200,
      height: 280,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 80,
            height: 160,
            channels: 4,
            background: { r: 20, g: 20, b: 20, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: 60,
        top: 50,
      },
    ])
    .png()
    .toBuffer();
}

describe("preprocessSketch", () => {
  it("returns processed and lineart PNG buffers", async () => {
    const input = await sketchFixture();
    const { processed, lineart } = await preprocessSketch(input);

    expect(processed.length).toBeGreaterThan(100);
    expect(lineart.length).toBeGreaterThan(100);

    const processedMeta = await sharp(processed).metadata();
    const lineartMeta = await sharp(lineart).metadata();
    expect(processedMeta.format).toBe("png");
    expect(lineartMeta.format).toBe("png");
  });
});
