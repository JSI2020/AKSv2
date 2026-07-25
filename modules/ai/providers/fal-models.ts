/**
 * Verified fal.ai model endpoints — pricing sources (2026-07-25):
 * - hero/angle: https://fal.ai/models/fal-ai/flux-general/image-to-image ($0.075/MP)
 * - draft:      https://fal.ai/models/fal-ai/flux/dev/image-to-image ($0.03/MP)
 * - colourway:  https://fal.ai/models/fal-ai/flux-2/turbo/edit ($0.008/MP input+output)
 * - tryon:      https://fal.ai/models/easel-ai/advanced-face-swap (face swap onto frozen render)
 */
import type { AiJobType, DefaultAiModelsMap } from "@/modules/ai/prompts";

export const VERIFIED_FAL_TRYON_MODEL = "easel-ai/advanced-face-swap";

export const VERIFIED_FAL_MODELS: DefaultAiModelsMap = {
  hero: "fal-ai/flux-general/image-to-image",
  angle: "fal-ai/flux-general/image-to-image",
  colourway: "fal-ai/flux-2/turbo/edit",
  draft: "fal-ai/flux/dev/image-to-image",
};

/** Estimated cost per 1024×1024 image in USD micro-dollars. */
export const ESTIMATED_COST_USD_MICROS: Record<AiJobType, number> = {
  hero: 75_000,
  angle: 75_000,
  colourway: 16_000,
  draft: 30_000,
};

export function estimateCostUsdMicros(
  jobType: AiJobType,
  width = 1024,
  height = 1024,
): number {
  const megapixels = Math.ceil((width * height) / 1_000_000);
  const perMp: Record<AiJobType, number> = {
    hero: 75_000,
    angle: 75_000,
    colourway: 16_000,
    draft: 30_000,
  };
  return perMp[jobType] * megapixels;
}

export function jobTypeForStage(
  stage: "HERO" | "ANGLE" | "COLOURWAY",
): AiJobType {
  switch (stage) {
    case "HERO":
      return "hero";
    case "ANGLE":
      return "angle";
    case "COLOURWAY":
      return "colourway";
  }
}

export function inferJobTypeFromModelId(
  modelId: string,
): "hero" | "colourway" | "draft" {
  if (modelId.includes("turbo/edit")) return "colourway";
  if (modelId.includes("flux/dev")) return "draft";
  return "hero";
}
