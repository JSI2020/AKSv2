import { describe, expect, it } from "vitest";

import { WebhookVerificationError } from "../../types";
import {
  parseSafepayTimestampMs,
  signSafepayWebhook,
  verifySafepaySignature,
} from "./verify-signature";

const SECRET = Buffer.from("aks-skew-test-secret").toString("base64");

describe("parseSafepayTimestampMs", () => {
  it("parses ISO and unix seconds", () => {
    const iso = "2026-08-12T10:00:00.000Z";
    expect(parseSafepayTimestampMs(iso)).toBe(Date.parse(iso));
    expect(parseSafepayTimestampMs("1723456800")).toBe(1723456800 * 1000);
  });
});

describe("verifySafepaySignature freshness", () => {
  it("accepts a fresh timestamp", () => {
    const rawBody = '{"ok":true}';
    const timestamp = new Date().toISOString();
    const signature = signSafepayWebhook({
      secretBase64: SECRET,
      rawBody,
      timestamp,
    });
    expect(() =>
      verifySafepaySignature({
        secretBase64: SECRET,
        rawBody,
        signature,
        timestamp,
      }),
    ).not.toThrow();
  });

  it("rejects a stale timestamp", () => {
    const rawBody = '{"ok":true}';
    const timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const signature = signSafepayWebhook({
      secretBase64: SECRET,
      rawBody,
      timestamp,
    });
    expect(() =>
      verifySafepaySignature({
        secretBase64: SECRET,
        rawBody,
        signature,
        timestamp,
      }),
    ).toThrow(WebhookVerificationError);
  });
});
