import { fal } from "@fal-ai/client";

import type {
  GenerationResult,
  ImageGenProvider,
  ModerationInput,
  ModerationResult,
  RecolourInput,
  SketchToGarmentInput,
} from "../types";
import { estimateCostUsdMicros } from "./fal-models";

type FalImage = {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
};

type FalGenerationData = {
  images?: FalImage[];
  seed?: number;
  has_nsfw_concepts?: boolean[];
  timings?: { inference?: number };
};

function requireFalKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error(
      "FAL_KEY is not set. Add it to .env.local or use AI_GENERATION_MOCK=1 for dev/test.",
    );
  }
  fal.config({ credentials: key });
  return key;
}

function megapixelCostUsdMicros(modelId: string, width: number, height: number): number {
  const mp = Math.ceil((width * height) / 1_000_000);
  if (modelId.includes("flux-2/turbo/edit")) {
    return 8_000 * mp * 2;
  }
  if (modelId.includes("flux/dev")) {
    return 30_000 * mp;
  }
  if (modelId.includes("flux-general")) {
    return 75_000 * mp;
  }
  return estimateCostUsdMicros("hero", width, height);
}

async function runFalSubscribe(
  modelId: string,
  input: Record<string, unknown>,
): Promise<{ data: FalGenerationData; latencyMs: number }> {
  requireFalKey();
  const started = Date.now();
  const result = await fal.subscribe(modelId, { input });
  const latencyMs = Date.now() - started;
  return { data: result.data as FalGenerationData, latencyMs };
}

function extractImage(data: FalGenerationData): FalImage {
  const image = data.images?.[0];
  if (!image?.url) {
    throw new Error("fal response missing image url");
  }
  return image;
}

export function createFalImageGenProvider(): ImageGenProvider {
  return {
    async sketchToGarment(input: SketchToGarmentInput): Promise<GenerationResult> {
      const { data, latencyMs } = await runFalSubscribe(input.modelId, {
        prompt: input.prompt,
        negative_prompt: input.negativePrompt ?? "",
        image_url: input.imageUrl,
        seed: input.seed,
        strength: input.strength ?? 0.85,
        image_size: "square_hd",
        output_format: "png",
        enable_safety_checker: true,
      });
      const image = extractImage(data);
      const width = image.width ?? 1024;
      const height = image.height ?? 1024;
      return {
        imageUrl: image.url,
        costUsdMicros: megapixelCostUsdMicros(input.modelId, width, height),
        latencyMs,
        seed: data.seed,
        hasNsfw: data.has_nsfw_concepts?.[0],
      };
    },

    async recolour(input: RecolourInput): Promise<GenerationResult> {
      const { data, latencyMs } = await runFalSubscribe(input.modelId, {
        prompt: input.prompt,
        image_urls: [input.imageUrl],
        seed: input.seed,
        image_size: "square_hd",
        output_format: "png",
      });
      const image = extractImage(data);
      const width = image.width ?? 1024;
      const height = image.height ?? 1024;
      return {
        imageUrl: image.url,
        costUsdMicros: megapixelCostUsdMicros(input.modelId, width, height),
        latencyMs,
        seed: data.seed,
        hasNsfw: data.has_nsfw_concepts?.[0],
      };
    },

    async moderate(input: ModerationInput): Promise<ModerationResult> {
      const { data } = await runFalSubscribe(
        "fal-ai/flux/dev/image-to-image",
        {
          prompt: "content safety check",
          image_url: input.imageUrl,
          num_inference_steps: 1,
          enable_safety_checker: true,
        },
      );
      const flagged = data.has_nsfw_concepts?.[0] === true;
      return flagged
        ? { safe: false, reason: "NSFW concept detected by fal safety checker" }
        : { safe: true };
    },
  };
}

export function isFalConfigured(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}
