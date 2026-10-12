import { readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

describe("app icon", () => {
  it("is a square 1024 PNG derived for developer consoles", async () => {
    const file = readFileSync("public/app-icon-1024.png");
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);

    const source = await sharp(readFileSync("app/icon.png")).metadata();
    expect(source.width).toBe(1024);
    expect(source.height).toBe(559);
  });
});
