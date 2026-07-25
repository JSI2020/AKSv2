import { and, eq } from "drizzle-orm";

import {
  assets,
  db,
  designInputs,
  designPromptProfiles,
  houseModels,
  STUDIO_SETTINGS_SINGLETON_ID,
  studioSettings,
} from "@aks/db";

import { buildSketchToPhotoPrompt } from "@/modules/ai/prompts";
import { createPresignedReadUrl } from "@/modules/platform/assets";

export type HeroPromptContext = {
  prompt: string;
  negative: string;
  templateVersion: number;
  sourceImageUrl: string;
  inputAssetIds: string[];
  archetypeId: string;
  sizeBlockSnapshot: Record<string, unknown> | null;
};

async function resolveSketchSourceUrl(designId: string): Promise<{
  url: string;
  assetIds: string[];
}> {
  const rows = await db
    .select({
      assetId: designInputs.assetId,
      derivedAssetId: designInputs.derivedAssetId,
      role: designInputs.role,
    })
    .from(designInputs)
    .where(eq(designInputs.designId, designId));

  const front =
    rows.find((r) => r.role === "SKETCH_FRONT") ??
    rows.find((r) => r.role === "TECHNICAL_FLAT") ??
    rows.find((r) => r.role.startsWith("SKETCH_"));

  if (!front) {
    throw new Error("Upload a front sketch before generating the hero.");
  }

  const useAssetId = front.derivedAssetId ?? front.assetId;
  const [asset] = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, useAssetId))
    .limit(1);
  if (!asset) throw new Error("Sketch asset not found.");

  const url = await createPresignedReadUrl(asset.r2Key, 3600);
  return { url, assetIds: [front.assetId] };
}

export async function buildHeroPromptContext(
  designId: string,
): Promise<HeroPromptContext> {
  const [profile] = await db
    .select()
    .from(designPromptProfiles)
    .where(eq(designPromptProfiles.designId, designId))
    .limit(1);
  if (!profile) {
    throw new Error("Design brief not found — complete the brief first.");
  }

  const [settings] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  const archetypeId = settings?.defaultArchetypeId;
  if (!archetypeId) {
    throw new Error("Studio default archetype is not configured.");
  }

  const [archetype] = await db
    .select({
      id: houseModels.id,
      buildDescription: houseModels.buildDescription,
      heightCm: houseModels.heightCm,
      heightInches: houseModels.heightInches,
    })
    .from(houseModels)
    .where(and(eq(houseModels.id, archetypeId), eq(houseModels.active, true)))
    .limit(1);
  if (!archetype) {
    throw new Error("Default archetype not found.");
  }

  const templateVersion =
    settings?.activePromptTemplateVersion ?? profile.templateVersion;

  const { prompt, negative, templateVersion: builtVersion } =
    buildSketchToPhotoPrompt(
      {
        garmentDescription: profile.garmentDescription,
        shirtColour: profile.shirtColour,
        shirtFabric: profile.shirtFabric,
        trouserColour: profile.trouserColour,
        trouserFabric: profile.trouserFabric,
        embroideryDescription: profile.embroideryDescription,
        angle: "front full length",
        houseModel: {
          buildDescription: archetype.buildDescription,
          heightCm: archetype.heightCm,
          heightInches: archetype.heightInches,
        },
        backdrop: profile.backdrop ?? settings?.backdropLightingProfile,
      },
      templateVersion as 1,
    );

  const sketch = await resolveSketchSourceUrl(designId);

  return {
    prompt,
    negative,
    templateVersion: builtVersion,
    sourceImageUrl: sketch.url,
    inputAssetIds: sketch.assetIds,
    archetypeId: archetype.id,
    sizeBlockSnapshot: settings?.defaultBaseSizeLabel
      ? { baseSizeLabel: settings.defaultBaseSizeLabel }
      : null,
  };
}
