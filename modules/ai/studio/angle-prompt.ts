import { and, eq } from "drizzle-orm";

import {
  assets,
  db,
  designGenerations,
  designInputs,
  designLocks,
  designPromptProfiles,
  houseModels,
  STUDIO_SETTINGS_SINGLETON_ID,
  studioSettings,
} from "@aks/db";
import type { RenderAngle } from "@aks/shared";

import { buildSketchToPhotoPrompt } from "@/modules/ai/prompts";
import { createPresignedReadUrl } from "@/modules/platform/assets";

export type AngleTarget = Extract<RenderAngle, "THREE_QUARTER" | "BACK">;

export type AngleSourceMode = "sketch" | "interpolated";

export type AnglePromptContext = {
  angle: AngleTarget;
  prompt: string;
  negative: string;
  templateVersion: number;
  sourceImageUrl: string;
  heroImageUrl: string;
  sourceMode: AngleSourceMode;
  sourceLabel: string;
  inputAssetIds: string[];
  archetypeId: string;
  sizeBlockSnapshot: Record<string, unknown> | null;
  parentGenerationId: string;
};

const SKETCH_ROLE_BY_ANGLE: Record<AngleTarget, "SKETCH_SIDE" | "SKETCH_BACK"> =
  {
    THREE_QUARTER: "SKETCH_SIDE",
    BACK: "SKETCH_BACK",
  };

const ANGLE_LABEL: Record<AngleTarget, string> = {
  THREE_QUARTER: "three-quarter",
  BACK: "back",
};

const ANGLE_PROMPT: Record<AngleTarget, string> = {
  THREE_QUARTER: "three-quarter view full length",
  BACK: "back view full length",
};

function sourceLabelFor(angle: AngleTarget, mode: AngleSourceMode): string {
  const label = ANGLE_LABEL[angle];
  return mode === "sketch"
    ? `${label}: from your sketch`
    : `${label}: interpolated`;
}

async function resolveLockedHeroGeneration(designId: string) {
  const [heroLock] = await db
    .select({ generationId: designLocks.generationId })
    .from(designLocks)
    .where(
      and(eq(designLocks.designId, designId), eq(designLocks.stage, "HERO")),
    )
    .limit(1);
  if (!heroLock) return null;

  const [gen] = await db
    .select()
    .from(designGenerations)
    .where(eq(designGenerations.id, heroLock.generationId))
    .limit(1);
  return gen ?? null;
}

async function resolveAssetReadUrl(assetId: string): Promise<string | null> {
  const [asset] = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!asset) return null;
  return createPresignedReadUrl(asset.r2Key, 3600);
}

async function resolveSketchForAngle(
  designId: string,
  angle: AngleTarget,
): Promise<{ url: string; assetIds: string[] } | null> {
  const role = SKETCH_ROLE_BY_ANGLE[angle];
  const [input] = await db
    .select({
      assetId: designInputs.assetId,
      derivedAssetId: designInputs.derivedAssetId,
    })
    .from(designInputs)
    .where(
      and(eq(designInputs.designId, designId), eq(designInputs.role, role)),
    )
    .limit(1);
  if (!input) return null;

  const useAssetId = input.derivedAssetId ?? input.assetId;
  const url = await resolveAssetReadUrl(useAssetId);
  if (!url) return null;
  return { url, assetIds: [input.assetId] };
}

function heroConsistencyBlock(heroImageUrl: string): string {
  return (
    "Match the locked front hero reference exactly for fabric, colour, lighting, " +
    "and embroidery placement — same garment, same model identity, only the camera angle changes. " +
    `Hero reference: ${heroImageUrl}.`
  );
}

function sketchStructureBlock(): string {
  return (
    "Follow the attached sketch for back/neckline/closure/hem structure. " +
    "Do not redesign or omit details drawn in the sketch."
  );
}

function interpolatedAngleBlock(angle: AngleTarget): string {
  const view =
    angle === "BACK"
      ? "Render the same garment from behind, preserving every visible front detail consistently on the back view."
      : "Render the same garment from a three-quarter angle, preserving silhouette and embroidery consistently.";
  return view;
}

export async function buildAnglePromptContext(
  designId: string,
  angle: AngleTarget,
): Promise<AnglePromptContext> {
  const heroGen = await resolveLockedHeroGeneration(designId);
  if (!heroGen?.outputAssetId) {
    throw new Error("Locked hero not found — approve the hero before generating angles.");
  }

  const heroImageUrl = await resolveAssetReadUrl(heroGen.outputAssetId);
  if (!heroImageUrl) {
    throw new Error("Locked hero asset not found.");
  }

  const [profile] = await db
    .select()
    .from(designPromptProfiles)
    .where(eq(designPromptProfiles.designId, designId))
    .limit(1);
  if (!profile) {
    throw new Error("Design brief not found.");
  }

  const [settings] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  const archetypeId = heroGen.archetypeId ?? settings?.defaultArchetypeId;
  if (!archetypeId) {
    throw new Error("Archetype not configured.");
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
    throw new Error("Archetype not found.");
  }

  const templateVersion =
    settings?.activePromptTemplateVersion ?? profile.templateVersion;

  const { prompt: basePrompt, negative, templateVersion: builtVersion } =
    buildSketchToPhotoPrompt(
      {
        garmentDescription: profile.garmentDescription,
        shirtColour: profile.shirtColour,
        shirtFabric: profile.shirtFabric,
        trouserColour: profile.trouserColour,
        trouserFabric: profile.trouserFabric,
        embroideryDescription: profile.embroideryDescription,
        angle: ANGLE_PROMPT[angle],
        houseModel: {
          buildDescription: archetype.buildDescription,
          heightCm: archetype.heightCm,
          heightInches: archetype.heightInches,
        },
        backdrop: profile.backdrop ?? settings?.backdropLightingProfile,
      },
      templateVersion as 1,
    );

  const sketch = await resolveSketchForAngle(designId, angle);
  const sourceMode: AngleSourceMode = sketch ? "sketch" : "interpolated";
  const sourceLabel = sourceLabelFor(angle, sourceMode);

  const consistency = heroConsistencyBlock(heroImageUrl);
  const prompt =
    sourceMode === "sketch"
      ? `${basePrompt} ${sketchStructureBlock()} ${consistency}`
      : `${basePrompt} ${interpolatedAngleBlock(angle)} ${consistency}`;

  return {
    angle,
    prompt,
    negative,
    templateVersion: builtVersion,
    sourceImageUrl: sketch?.url ?? heroImageUrl,
    heroImageUrl,
    sourceMode,
    sourceLabel,
    inputAssetIds: sketch?.assetIds ?? [],
    archetypeId: archetype.id,
    sizeBlockSnapshot: heroGen.sizeBlockSnapshot,
    parentGenerationId: heroGen.id,
  };
}

export async function buildAnglePromptContexts(
  designId: string,
): Promise<AnglePromptContext[]> {
  return Promise.all([
    buildAnglePromptContext(designId, "THREE_QUARTER"),
    buildAnglePromptContext(designId, "BACK"),
  ]);
}
