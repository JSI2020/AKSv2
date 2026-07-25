import type { TryOnProvider } from "../types";
import { createFalTryOnProvider, isFalTryOnConfigured } from "./fal-tryon";
import { createMockTryOnProvider } from "./mock-tryon";

export { createFalTryOnProvider, isFalTryOnConfigured } from "./fal-tryon";
export { createMockTryOnProvider } from "./mock-tryon";

export function getTryOnProvider(): TryOnProvider {
  if (isFalTryOnConfigured()) {
    return createFalTryOnProvider();
  }
  if (process.env.AI_GENERATION_MOCK === "1") {
    return createMockTryOnProvider();
  }
  throw new Error(
    "FAL_KEY is not set. Set FAL_KEY for live try-on or AI_GENERATION_MOCK=1 for dev/test.",
  );
}

export function isTryOnAvailable(): boolean {
  return isFalTryOnConfigured() || process.env.AI_GENERATION_MOCK === "1";
}
