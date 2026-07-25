export type SafepayConfig = {
  baseUrl: string;
  aggregatorId: string;
  secretKey: string;
  aggregatorMerchantIdentifier: string;
  webhookSecret: string;
};

export function readSafepayConfig(): SafepayConfig {
  const baseUrl =
    process.env.SAFEPAY_BASE_URL ?? "https://api.getsafepay.com/raastwire";
  const aggregatorId = process.env.SAFEPAY_AGGREGATOR_ID;
  const secretKey = process.env.SAFEPAY_SECRET_KEY;
  const aggregatorMerchantIdentifier =
    process.env.SAFEPAY_AGGREGATOR_MERCHANT_IDENTIFIER;
  const webhookSecret = process.env.SAFEPAY_WEBHOOK_SECRET;

  if (!aggregatorId) {
    throw new Error("SAFEPAY_AGGREGATOR_ID is required.");
  }
  if (!secretKey) {
    throw new Error("SAFEPAY_SECRET_KEY is required.");
  }
  if (!aggregatorMerchantIdentifier) {
    throw new Error("SAFEPAY_AGGREGATOR_MERCHANT_IDENTIFIER is required.");
  }
  if (!webhookSecret) {
    throw new Error("SAFEPAY_WEBHOOK_SECRET is required.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    aggregatorId,
    secretKey,
    aggregatorMerchantIdentifier,
    webhookSecret,
  };
}

export function readSafepayConfigOrNull(): SafepayConfig | null {
  try {
    return readSafepayConfig();
  } catch {
    return null;
  }
}
