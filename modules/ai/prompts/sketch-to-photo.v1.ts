/** Verified fal model ids — see modules/ai/providers/fal-models.ts for pricing sources. */
export type AiJobType = "hero" | "angle" | "colourway" | "draft";

export type DefaultAiModelsMap = Record<AiJobType, string>;

export const VERIFIED_FAL_MODEL_HERO = "fal-ai/flux-general/image-to-image";
export const VERIFIED_FAL_MODEL_ANGLE = "fal-ai/flux-general/image-to-image";
export const VERIFIED_FAL_MODEL_COLOURWAY = "fal-ai/flux-2/turbo/edit";
export const VERIFIED_FAL_MODEL_DRAFT = "fal-ai/flux/dev/image-to-image";

export const DEFAULT_AI_MODEL_PLACEHOLDERS: DefaultAiModelsMap = {
  hero: VERIFIED_FAL_MODEL_HERO,
  angle: VERIFIED_FAL_MODEL_ANGLE,
  colourway: VERIFIED_FAL_MODEL_COLOURWAY,
  draft: VERIFIED_FAL_MODEL_DRAFT,
};
export const DEFAULT_BACKDROP_LIGHTING_PROFILE =
  "Clean studio, seamless warm-greige background, soft diffused daylight";

export const ACTIVE_PROMPT_TEMPLATE_VERSION = 1;

export type HouseModelPromptBlock = {
  buildDescription: string | null;
  heightCm: number;
  heightInches: number;
};

export type SketchToPhotoPromptVars = {
  garmentDescription: string;
  shirtColour: string;
  shirtFabric: string;
  trouserColour: string;
  trouserFabric: string;
  embroideryDescription: string;
  angle: string;
  houseModel: HouseModelPromptBlock;
  /** Optional per-design or studio-default backdrop override. */
  backdrop?: string | null;
};

export type BuiltPrompt = {
  prompt: string;
  negative: string;
  templateVersion: number;
};

function formatHeight(block: HouseModelPromptBlock): string {
  const totalIn = block.heightInches / 100;
  const feet = Math.floor(totalIn / 12);
  const inchPart = totalIn - feet * 12;
  const inchStr =
    inchPart % 1 === 0
      ? `${inchPart}`
      : inchPart.toFixed(1).replace(/\.0$/, "");
  return `${feet}'${inchStr}″ (${block.heightCm} cm)`;
}

function buildModelBlock(houseModel: HouseModelPromptBlock): string {
  const build = houseModel.buildDescription?.trim() || "House model archetype.";
  return `Model: ${build} Height ${formatHeight(houseModel)}.`;
}

function buildGarmentBlock(vars: SketchToPhotoPromptVars): string {
  const lines = [
    `Garment: ${vars.garmentDescription.trim()}`,
    `Shirt: ${vars.shirtColour.trim()} ${vars.shirtFabric.trim()}`.trim(),
    `Trouser: ${vars.trouserColour.trim()} ${vars.trouserFabric.trim()}`.trim(),
  ];
  const embroidery = vars.embroideryDescription.trim();
  if (embroidery) {
    lines.push(`Embroidery: ${embroidery}`);
  }
  return lines.join(" ");
}

export const SKETCH_TO_PHOTO_V1 = {
  version: 1 as const,
  build(vars: SketchToPhotoPromptVars): Omit<BuiltPrompt, "templateVersion"> {
    const instruction =
      "Photorealistic fashion e-commerce photograph reproducing the garment precisely as drawn in the attached sketch, without redesigning or omitting any detail.";
    const setAndLighting =
      vars.backdrop?.trim() ||
      "Clean studio, seamless warm-greige background, soft diffused daylight.";
    const camera =
      "Camera: full length, 85mm lens look, sharp focus on garment.";
    const style =
      "Style: high-end modest fashion catalog photography, realistic not stylised.";
    const angle = `Angle: ${vars.angle.trim()}.`;

    const prompt = [
      instruction,
      buildGarmentBlock(vars),
      buildModelBlock(vars.houseModel),
      `Set and lighting: ${setAndLighting}.`,
      camera,
      style,
      angle,
    ].join(" ");

    const negative = [
      "no text",
      "no logo",
      "no altered neckline or hem",
      "no oversaturation",
      "no colour bleed between garment pieces",
      "no distortion of embroidery",
      "no Western dress",
    ].join(", ");

    return { prompt, negative };
  },
};

export const PROMPT_TEMPLATE_REGISTRY = {
  1: SKETCH_TO_PHOTO_V1,
} as const;

export type PromptTemplateVersion = keyof typeof PROMPT_TEMPLATE_REGISTRY;

export function getActivePromptTemplateVersion(): PromptTemplateVersion {
  return ACTIVE_PROMPT_TEMPLATE_VERSION;
}

export function buildSketchToPhotoPrompt(
  vars: SketchToPhotoPromptVars,
  templateVersion: PromptTemplateVersion = getActivePromptTemplateVersion(),
): BuiltPrompt {
  const template = PROMPT_TEMPLATE_REGISTRY[templateVersion];
  const built = template.build(vars);
  return { ...built, templateVersion };
}
