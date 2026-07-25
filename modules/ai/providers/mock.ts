import { createHash } from "crypto";

import type {
  GenerationResult,
  ImageGenProvider,
  ModerationInput,
  ModerationResult,
  RecolourInput,
  SketchToGarmentInput,
} from "../types";
import { estimateCostUsdMicros, inferJobTypeFromModelId } from "./fal-models";

/** 1×1 PNG — deterministic mock output for dev/CI without FAL_KEY. */
export const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function mockImageDataUri(seed?: number): string {
  const suffix = seed != null ? `#seed=${seed}` : "";
  return `data:image/png;base64,${MOCK_PNG_BASE64}${suffix}`;
}

export function createMockImageGenProvider(): ImageGenProvider {
  return {
    async sketchToGarment(input: SketchToGarmentInput): Promise<GenerationResult> {
      const jobType = inferJobTypeFromModelId(input.modelId);
      const seed =
        input.seed ??
        Number.parseInt(
          createHash("sha256").update(input.prompt).digest("hex").slice(0, 8),
          16,
        );
      return {
        imageUrl: mockImageDataUri(seed),
        costUsdMicros: estimateCostUsdMicros(jobType),
        latencyMs: 42,
        seed,
        hasNsfw: false,
      };
    },

    async recolour(input: RecolourInput): Promise<GenerationResult> {
      const seed =
        input.seed ??
        Number.parseInt(
          createHash("sha256").update(input.prompt).digest("hex").slice(0, 8),
          16,
        );
      return {
        imageUrl: mockImageDataUri(seed),
        costUsdMicros: estimateCostUsdMicros("colourway"),
        latencyMs: 42,
        seed,
        hasNsfw: false,
      };
    },

    async moderate(_input: ModerationInput): Promise<ModerationResult> {
      return { safe: true };
    },
  };
}
