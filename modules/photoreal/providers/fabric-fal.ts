import { fal } from "@fal-ai/client";

const FABRIC_EDIT_MODEL = "fal-ai/nano-banana-2/edit";

function configureFal(): void {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY is not configured.");
  fal.config({ credentials: key });
}

function extractImageUrl(data: {
  images?: Array<string | { url?: string }>;
}): string | null {
  const first = data.images?.[0];
  return typeof first === "string" ? first : (first?.url ?? null);
}

/** Vision read of the swatch — locks hue/value/weave in the edit prompt. */
export async function describeFabricSwatch(
  imageUrl: string,
): Promise<string | null> {
  configureFal();
  const endpoint =
    process.env.FAL_VISION_MODEL?.trim() || "fal-ai/any-llm/vision";
  const model =
    process.env.FAL_VISION_LLM?.trim() || "google/gemini-2.5-flash";

  try {
    const result = await fal.subscribe(endpoint, {
      input: {
        prompt:
          'Study this fabric swatch photo. Return JSON only: {"colour":"precise colour — hue, lightness, warm/cool bias (e.g. cool medium grey with blue undertone, NOT beige or brown)","weave":"visible weave/knit pattern and grain","sheen":"matte, semi-matte, or lustre"}.',
        image_urls: [imageUrl],
        model,
        temperature: 0.05,
        system_prompt:
          "Return valid JSON only. Describe the textile colour exactly as seen — do not idealize or warm-shift.",
      },
    });

    const data = result.data as Record<string, unknown>;
    const raw =
      (typeof data.output === "string" && data.output) ||
      (typeof data.text === "string" && data.text) ||
      "";

    if (!raw.trim()) return null;

    try {
      const parsed = JSON.parse(raw) as {
        colour?: string;
        weave?: string;
        sheen?: string;
      };
      return [
        parsed.colour && `colour: ${parsed.colour}`,
        parsed.weave && `weave: ${parsed.weave}`,
        parsed.sheen && `sheen: ${parsed.sheen}`,
      ]
        .filter(Boolean)
        .join("; ");
    } catch {
      return raw.slice(0, 280);
    }
  } catch {
    return null;
  }
}

/** Catalogue spiral drape — composition edit only; swatch colour/weave must survive. */
export async function generateFabricCataloguePhoto(
  swatchUrl: string,
  prompt: string,
): Promise<string | null> {
  configureFal();

  const result = await fal.subscribe(FABRIC_EDIT_MODEL, {
    input: {
      prompt,
      image_urls: [swatchUrl],
      aspect_ratio: "1:1",
      num_images: 1,
      output_format: "png",
      resolution: "2K",
      limit_generations: true,
    },
    logs: false,
  });

  return extractImageUrl(result.data as { images?: Array<string | { url?: string }> });
}
