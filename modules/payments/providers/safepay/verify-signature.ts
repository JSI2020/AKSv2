import { createHmac, timingSafeEqual } from "node:crypto";

import { WebhookVerificationError } from "../../types";

/** Safepay HMAC per https://safepay.mintlify.app/guides/webhooks-delivery */
export function verifySafepaySignature(input: {
  secretBase64: string;
  rawBody: string;
  signature: string;
  timestamp: string;
}): void {
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
