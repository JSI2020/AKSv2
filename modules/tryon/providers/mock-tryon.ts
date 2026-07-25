import { createHash } from "crypto";

import type { TryOnPersonaliseInput, TryOnPersonaliseResult, TryOnProvider } from "../types";
import { ESTIMATED_TRYON_COST_USD_MICROS } from "../types";
import { MOCK_PNG_BASE64 } from "@/modules/ai/providers/mock";

export function createMockTryOnProvider(): TryOnProvider {
  return {
    async personalise(input: TryOnPersonaliseInput): Promise<TryOnPersonaliseResult> {
      const seed = createHash("sha256")
        .update(`${input.targetImageUrl}:${input.faceImageUrl}`)
        .digest("hex")
        .slice(0, 8);
      return {
        imageUrl: `data:image/png;base64,${MOCK_PNG_BASE64}#seed=${seed}`,
        costUsdMicros: ESTIMATED_TRYON_COST_USD_MICROS,
        latencyMs: 42,
      };
    },
  };
}
