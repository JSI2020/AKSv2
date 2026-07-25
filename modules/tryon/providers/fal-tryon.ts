import { fal } from "@fal-ai/client";

import type { TryOnPersonaliseInput, TryOnPersonaliseResult, TryOnProvider } from "../types";
import { ESTIMATED_TRYON_COST_USD_MICROS } from "../types";

type FalImage = {
  url: string;
  width?: number;
  height?: number;
};

type FalFaceSwapData = {
  image?: FalImage;
  images?: FalImage[];
};

function requireFalKey(): void {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error(
      "FAL_KEY is not set. Add it to .env.local or use AI_GENERATION_MOCK=1 for dev/test.",
    );
  }
  fal.config({ credentials: key });
}

function extractImage(data: FalFaceSwapData): FalImage {
  const image = data.image ?? data.images?.[0];
  if (!image?.url) {
    throw new Error("fal face-swap response missing image url");
  }
  return image;
}

/**
 * Face-preserving personalisation via easel-ai/advanced-face-swap.
 * Swaps customer face onto frozen garment render — garment pixels preserved.
 * @see https://fal.ai/models/easel-ai/advanced-face-swap
 */
export function createFalTryOnProvider(): TryOnProvider {
  return {
    async personalise(input: TryOnPersonaliseInput): Promise<TryOnPersonaliseResult> {
      requireFalKey();
      const started = Date.now();
      const gender =
        input.gender === "male"
          ? "male"
          : input.gender === "female"
            ? "female"
            : "female";

      const result = await fal.subscribe(input.modelId, {
        input: {
          target_image: input.targetImageUrl,
          face_image_0: input.faceImageUrl,
          gender_0: gender,
          workflow_type: "target_hair",
          upscale: true,
          detailer: false,
        },
      });

      const image = extractImage(result.data as FalFaceSwapData);
      return {
        imageUrl: image.url,
        costUsdMicros: ESTIMATED_TRYON_COST_USD_MICROS,
        latencyMs: Date.now() - started,
      };
    },
  };
}

export function isFalTryOnConfigured(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}
