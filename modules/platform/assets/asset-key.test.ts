import { describe, expect, it } from "vitest";

import { assertSafeAssetKey, localDiskUploadsEnabled } from "./r2";

describe("assertSafeAssetKey", () => {
  it("accepts normal relative keys", () => {
    expect(assertSafeAssetKey("temp-merch/unsplash/a.jpg")).toBe(
      "temp-merch/unsplash/a.jpg",
    );
    expect(assertSafeAssetKey("/uploads/user/x.png")).toBe(
      "uploads/user/x.png",
    );
  });

  it("rejects path traversal", () => {
    expect(() => assertSafeAssetKey("../.env")).toThrow(/Invalid asset key/);
    expect(() => assertSafeAssetKey("foo/../../.env")).toThrow(
      /Invalid asset key/,
    );
    expect(() => assertSafeAssetKey("..%2F.env")).toThrow(/Invalid asset key/);
  });

  it("rejects Windows absolute and backslash keys", () => {
    expect(() => assertSafeAssetKey("C:/Windows/win.ini")).toThrow(
      /Invalid asset key/,
    );
    expect(() => assertSafeAssetKey("C:\\Windows\\win.ini")).toThrow(
      /Invalid asset key/,
    );
    expect(() => assertSafeAssetKey("foo\\bar.jpg")).toThrow(
      /Invalid asset key/,
    );
  });

  it("allows disk uploads in production when R2_FORCE_LOCAL is set", () => {
    const previousNode = process.env.NODE_ENV;
    const previousForce = process.env.R2_FORCE_LOCAL;
    process.env.NODE_ENV = "production";
    process.env.R2_FORCE_LOCAL = "1";
    try {
      expect(localDiskUploadsEnabled()).toBe(true);
      delete process.env.R2_FORCE_LOCAL;
      expect(localDiskUploadsEnabled()).toBe(false);
    } finally {
      process.env.NODE_ENV = previousNode;
      if (previousForce === undefined) delete process.env.R2_FORCE_LOCAL;
      else process.env.R2_FORCE_LOCAL = previousForce;
    }
  });

  it("rejects empty and null-byte keys", () => {
    expect(() => assertSafeAssetKey("")).toThrow(/Invalid asset key/);
    expect(() => assertSafeAssetKey("   ")).toThrow(/Invalid asset key/);
    expect(() => assertSafeAssetKey("a\0b")).toThrow(/Invalid asset key/);
  });
});
