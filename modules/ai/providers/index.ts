import type { ImageGenProvider } from "../types";
import { createFalImageGenProvider, isFalConfigured } from "./fal";
import { createMockImageGenProvider } from "./mock";

export {
  VERIFIED_FAL_MODELS,
  ESTIMATED_COST_USD_MICROS,
  estimateCostUsdMicros,
  jobTypeForStage,
} from "./fal-models";
export { createFalImageGenProvider, isFalConfigured } from "./fal";
export { createMockImageGenProvider, MOCK_PNG_BASE64 } from "./mock";

export function getImageGenProvider(): ImageGenProvider {
  if (isFalConfigured()) {
    return createFalImageGenProvider();
  }
  if (process.env.AI_GENERATION_MOCK === "1") {
    return createMockImageGenProvider();
  }
  throw new Error(
    "FAL_KEY is not set. Set FAL_KEY for live generation or AI_GENERATION_MOCK=1 for dev/test.",
  );
}
