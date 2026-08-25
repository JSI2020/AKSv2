import { fal } from "@fal-ai/client";
import type { VisionAdapter } from "../recognition/adapter";

export function falKey(): string {
  return process.env.FAL_KEY?.trim() ?? "";
}

function configure() {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY is not configured.");
  fal.config({ credentials: key });
}

export async function uploadVisionFile(file: File): Promise<string> {
  configure();
  return fal.storage.upload(file);
}

export async function renderFalEdit(file: File, prompt: string): Promise<string | null> {
  configure();
  const sourceUrl = await fal.storage.upload(file);
  const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
    input: {
      prompt,
      image_urls: [sourceUrl],
      aspect_ratio: "3:4",
      num_images: 1,
      output_format: "png",
      resolution: "1K",
    },
  });
  const data = result.data as { images?: Array<string | { url?: string }> };
  const first = data.images?.[0];
  return typeof first === "string" ? first : first?.url ?? null;
}

export function createFalVisionAdapter(): VisionAdapter {
  configure();
  const endpoint = process.env.FAL_VISION_MODEL?.trim() || "fal-ai/any-llm/vision";
  const model = process.env.FAL_VISION_LLM?.trim() || "google/gemini-2.5-flash";
  return {
    async complete(imageUrl, prompt) {
      const result = await fal.subscribe(endpoint, {
        input: {
          prompt,
          image_urls: [imageUrl],
          model,
          temperature: 0.1,
          system_prompt: "Return JSON only. Do not invent measurements.",
        },
      });
      const data = result.data as Record<string, unknown>;
      if (typeof data.output === "string") return data.output;
      if (typeof data.text === "string") return data.text;
      return JSON.stringify(data);
    },
  };
}
