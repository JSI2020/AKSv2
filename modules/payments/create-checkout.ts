import { readSafepayConfig } from "./config";
import { getSafepayProvider } from "./providers/safepay";
import type { CreateCheckoutInput } from "./types";

export async function createSafepayCheckout(input: CreateCheckoutInput) {
  const provider = getSafepayProvider(readSafepayConfig());
  return provider.createCheckout(input);
}
