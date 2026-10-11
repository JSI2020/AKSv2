"use server";

import { fal } from "@fal-ai/client";

import { STUDIO_BACKGROUND_PRESETS } from "@/modules/designs/studio-backgrounds";

import { COMMERCIAL_POSES } from "./commercial-poses";
import { BRAND_DIRECTION, DETAIL_SHOT_IDS, FALLBACK_ADVICE } from "./shoot-advice";

export type ShootAdvice = {
  /** Short description of the garment, e.g. "gold silk kaftan with zari neckline". */
  garment: string;
  occasion: string;
  /** Location preset ids, best first. */
  locations: string[];
  /** Pose ids for the recommended shot set, in shooting order. */
  shots: string[];
  /** One sentence on why. */
  reason: string;
  /** False when the vision call failed and the brand defaults were used. */
  fromAi: boolean;
};

const LOCATION_IDS = new Set<string>(STUDIO_BACKGROUND_PRESETS.map((p) => p.id));
const POSE_IDS = new Set(COMMERCIAL_POSES.map((p) => p.id));

function buildPrompt(): string {
  const locations = STUDIO_BACKGROUND_PRESETS.map(
    (p) => `${p.id} — ${p.label} (${p.group})`,
  ).join("\n");
  const poses = COMMERCIAL_POSES.map((p) => `${p.id} — ${p.label} (${p.category})`).join(
    "\n",
  );
  return `You are the art director for a Pakistani womenswear label. ${BRAND_DIRECTION}

Look at the garment in the photo(s) and plan its catalogue shoot.

Choose from these LOCATIONS (use the ids exactly):
${locations}

Choose from these POSES (use the ids exactly):
${poses}

Rules:
- locations: the 3 most fitting location ids, best first. Prefer natural light and neutral, uncluttered settings that let the garment lead; pick heritage or outdoor settings only when the garment's colour, fabric and occasion clearly call for it.
- shots: 6 pose ids in shooting order — start with a full-length front, include a three-quarter or movement shot, a waist-up portrait, a back view, and at least one embroidery or detail close-up (detail-embroidery, detail-neckline, detail-sleeve or detail-hem). Avoid seated or floor poses for heavy bridal wear.
- garment: under 12 words, e.g. "gold silk kaftan with zari neckline".
- occasion: one of everyday, formal, festive, bridal.
- reason: one short sentence a shop owner would understand.

Return JSON only: {"garment": "...", "occasion": "...", "locations": ["..."], "shots": ["..."], "reason": "..."}`;
}

function parse(raw: string): Partial<ShootAdvice> | null {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as Partial<ShootAdvice>;
  } catch {
    return null;
  }
}

/**
 * Read the uploaded dress and recommend locations + a shot set in the brand's
 * minimalist-luxury direction. Never throws: on any failure the brand
 * defaults come back with `fromAi: false`.
 */
export async function recommendShootAction(input: {
  imageUrls: string[];
}): Promise<ShootAdvice> {
  const { requirePermission } = await import("@/modules/auth");
  await requirePermission("photoreal.generate");

  const imageUrls = input.imageUrls.filter(Boolean).slice(0, 4);
  const key = process.env.FAL_KEY?.trim();
  if (!imageUrls.length || !key) return FALLBACK_ADVICE;

  try {
    fal.config({ credentials: key });
    const result = await fal.subscribe(
      process.env.FAL_VISION_MODEL?.trim() || "fal-ai/any-llm/vision",
      {
        input: {
          prompt: buildPrompt(),
          image_urls: imageUrls,
          model: process.env.FAL_VISION_LLM?.trim() || "google/gemini-2.5-flash",
          temperature: 0.2,
          system_prompt: "Return valid JSON only.",
        },
      },
    );
    const data = result.data as Record<string, unknown>;
    const raw =
      (typeof data.output === "string" && data.output) ||
      (typeof data.text === "string" && data.text) ||
      "";
    const parsed = parse(raw);
    if (!parsed) return FALLBACK_ADVICE;

    const locations = (parsed.locations ?? []).filter((id) => LOCATION_IDS.has(id));
    let shots = [...new Set((parsed.shots ?? []).filter((id) => POSE_IDS.has(id)))].slice(0, 8);
    // Brand rule: every set has an embroidery/detail close-up.
    if (!shots.some((id) => DETAIL_SHOT_IDS.includes(id))) {
      shots = [...shots.slice(0, 7), "detail-embroidery"];
    }

    return {
      garment: String(parsed.garment ?? "").slice(0, 120) || FALLBACK_ADVICE.garment,
      occasion: String(parsed.occasion ?? "").slice(0, 20) || FALLBACK_ADVICE.occasion,
      locations: locations.length ? locations.slice(0, 3) : FALLBACK_ADVICE.locations,
      shots: shots.length >= 3 ? shots : FALLBACK_ADVICE.shots,
      reason: String(parsed.reason ?? "").slice(0, 240) || FALLBACK_ADVICE.reason,
      fromAi: true,
    };
  } catch (err) {
    console.warn("[photoreal/advisor]", err);
    return FALLBACK_ADVICE;
  }
}
