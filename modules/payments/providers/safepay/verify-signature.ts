import { createHmac, timingSafeEqual } from "node:crypto";

import { WebhookVerificationError } from "../../types";

/** Reject captured webhooks older/newer than this skew (defence in depth). */
export const SAFEPAY_WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000;

/** Parse Safepay timestamp — unix seconds, unix ms, or ISO-8601. */
export function parseSafepayTimestampMs(timestamp: string): number | null {
  const trimmed = timestamp.trim();
  if (!trimmed) return null;

  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum > 0) {
    // 1e12 ms ≈ Sep 2001 in seconds — treat smaller as seconds.
    return asNum < 1e12 ? Math.round(asNum * 1000) : Math.round(asNum);
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Safepay HMAC per https://safepay.mintlify.app/guides/webhooks-delivery */
export function verifySafepaySignature(input: {
  secretBase64: string;
  rawBody: string;
  signature: string;
  timestamp: string;
  nowMs?: number;
  maxSkewMs?: number;
}): void {
  const tsMs = parseSafepayTimestampMs(input.timestamp);
  if (tsMs == null) {
    throw new WebhookVerificationError("Invalid webhook timestamp.");
  }

  const now = input.nowMs ?? Date.now();
  const maxSkew = input.maxSkewMs ?? SAFEPAY_WEBHOOK_MAX_SKEW_MS;
  if (Math.abs(now - tsMs) > maxSkew) {
    throw new WebhookVerificationError(
      "Webhook timestamp outside allowed window.",
    );
  }

  let decodedSecret: Buffer;
  try {
    decodedSecret = Buffer.from(input.secretBase64, "base64");
  } catch {
    throw new WebhookVerificationError("Invalid webhook secret encoding.");
  }

  const mac = createHmac("sha256", decodedSecret);
  mac.update(input.timestamp);
  mac.update(".");
  mac.update(input.rawBody);
  const expected = `sha256=${mac.digest("hex")}`;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(input.signature);
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new WebhookVerificationError();
  }
}

/** Test helper — signs a webhook body with the same algorithm as Safepay. */
export function signSafepayWebhook(input: {
  secretBase64: string;
  rawBody: string;
  timestamp: string;
}): string {
  const decodedSecret = Buffer.from(input.secretBase64, "base64");
  const mac = createHmac("sha256", decodedSecret);
  mac.update(input.timestamp);
  mac.update(".");
  mac.update(input.rawBody);
  return `sha256=${mac.digest("hex")}`;
}
