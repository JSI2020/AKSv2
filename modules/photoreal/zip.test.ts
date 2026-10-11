import { describe, expect, it } from "vitest";

import { buildStoredZip, crc32 } from "./zip";

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("buildStoredZip", () => {
  it("writes a valid archive with every entry", () => {
    const a = new TextEncoder().encode("hello");
    const b = new Uint8Array([0, 1, 2, 3, 255]);
    const zip = buildStoredZip([
      { name: "a.txt", data: a },
      { name: "b.bin", data: b },
    ]);
    const view = new DataView(zip.buffer);

    // Starts with a local file header, ends with the end-of-central-directory record.
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(2);

    // Central directory points back at the second entry's local header.
    const cdStart = view.getUint32(eocd + 16, true);
    expect(view.getUint32(cdStart, true)).toBe(0x02014b50);
    const secondCentral = cdStart + 46 + "a.txt".length;
    const secondLocal = view.getUint32(secondCentral + 42, true);
    expect(view.getUint32(secondLocal, true)).toBe(0x04034b50);
    expect(view.getUint32(secondLocal + 14, true)).toBe(crc32(b));
    expect([...zip.slice(secondLocal + 30 + 5, secondLocal + 30 + 5 + 5)]).toEqual([
      ...b,
    ]);
  });
});
