import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

import { uploadKeyOwnedByPrefix } from "@/modules/platform/assets/r2";

describe("uploadKeyOwnedByPrefix", () => {
  it("accepts keys under the owner prefix", () => {
    expect(
      uploadKeyOwnedByPrefix("uploads/user/abc/xyz", ["uploads/user/abc"]),
    ).toBe(true);
  });

  it("rejects another user's prefix", () => {
    expect(
      uploadKeyOwnedByPrefix("uploads/user/other/xyz", ["uploads/user/abc"]),
    ).toBe(false);
  });

  it("rejects prefix-substring tricks", () => {
    expect(
      uploadKeyOwnedByPrefix("uploads/user/abcdef/x", ["uploads/user/abc"]),
    ).toBe(false);
  });
});

describe("track access MAC shape", () => {
  it("HMAC differs from bare sha256 of payload", () => {
    const secret = "test-secret-for-unit";
    const payload = "AKS-1|a@b.com|9999999999999";
    const mac = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    const { createHash } = require("node:crypto") as typeof import("node:crypto");
    const bare = createHash("sha256").update(payload, "utf8").digest("hex");
    expect(mac).not.toBe(bare);
    expect(mac).toHaveLength(64);
  });
});
