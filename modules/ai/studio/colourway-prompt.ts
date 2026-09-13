import { createHash } from "crypto";
import { and, desc, eq } from "drizzle-orm";

import {
  assets,
  colourways,
  db,
  designGenerations,
  designLocks,
  designRenders,
  fabrics,
} from "@aks/db";
import type { RenderAngle } from "@aks/shared";
import { estimateCostUsdMicros } from "@/modules/ai/providers/fal-models";

import { createAiExternalReadUrl } from "@/modules/platform/assets";

const GALLERY_ANGLES = ["FRONT", "THREE_QUARTER", "BACK"] as const satisfies readonly RenderAngle[];

export type LockedAngleSource = {
  angle: RenderAngle;
  generationId: string;
  assetId: string;
  imageUrl: string;
  archetypeId: string | null;
};

export type ColourwayPromptContext = {
  angle: RenderAngle;
  prompt: string;
  templateVersion: number;
  sourceImageUrl: string;
  inputAssetIds: string[];
  parentGenerationId: string | null;
  colourwayId: string;
  batchSeed: number;
  batchGroupId: string;
};

/**
 * Manual Studio: use uploaded FRONT reference as the source for every slot.
 * Pose/camera change is driven by the prompt — same model & design.
 */
export async function resolveManualReferenceSources(
  designId: string,
): Promise<LockedAngleSource[]> {
  const [front] = await db
    .select({
      id: designRenders.id,
      assetId: designRenders.assetId,
    })
    .from(designRenders)
    .where(
      and(
        eq(designRenders.designId, designId),
        eq(designRenders.angle, "FRONT"),
      ),
    )
    .orderBy(desc(designRenders.createdAt))
    .limit(1);

  if (!front) {
    throw new Error("Upload a FRONT reference photo before generating angles.");
  }

  const imageUrl = await resolveAssetReadUrl(front.assetId);
  if (!imageUrl) {
    throw new Error("Reference photo is not readable — re-upload and try again.");
  }

  return GALLERY_ANGLES.map((angle) => ({
    angle,
    generationId: front.id,
    assetId: front.assetId,
    imageUrl,
    archetypeId: null,
  }));
}

function batchSeedFor(colourwayId: string, attemptN: number): number {
  const hex = createHash("sha256")
    .update(`${colourwayId}:${attemptN}`)
    .digest("hex")
    .slice(0, 8);
  return Number.parseInt(hex, 16);
}

async function resolveAssetReadUrl(assetId: string): Promise<string | null> {
  const [asset] = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!asset) return null;
  return createAiExternalReadUrl(asset.r2Key, 3600);
}

/** Locked hero (front) + latest approved derived angles. */
export async function resolveLockedGalleryAngles(
  designId: string,
): Promise<LockedAngleSource[]> {
  const [heroLock] = await db
    .select({ generationId: designLocks.generationId })
    .from(designLocks)
    .where(
      and(eq(designLocks.designId, designId), eq(designLocks.stage, "HERO")),
    )
    .limit(1);
  if (!heroLock) {
    throw new Error("Hero must be locked before colourway work.");
  }

  const [heroGen] = await db
    .select()
    .from(designGenerations)
    .where(eq(designGenerations.id, heroLock.generationId))
    .limit(1);
  if (!heroGen?.outputAssetId) {
    throw new Error("Locked hero output not found.");
  }

  const heroUrl = await resolveAssetReadUrl(heroGen.outputAssetId);
  if (!heroUrl) {
    throw new Error("Locked hero asset not readable.");
  }

  const sources: LockedAngleSource[] = [
    {
      angle: "FRONT",
      generationId: heroGen.id,
      assetId: heroGen.outputAssetId,
      imageUrl: heroUrl,
      archetypeId: heroGen.archetypeId,
    },
  ];

  for (const angle of ["THREE_QUARTER", "BACK"] as const) {
    const [row] = await db
      .select()
      .from(designGenerations)
      .where(
        and(
          eq(designGenerations.designId, designId),
          eq(designGenerations.stage, "ANGLE"),
          eq(designGenerations.angle, angle),
          eq(designGenerations.decision, "APPROVED"),
        ),
      )
      .orderBy(desc(designGenerations.createdAt))
      .limit(1);

    if (!row?.outputAssetId) {
      throw new Error(`Approved ${angle} generation not found.`);
    }

    const url = await resolveAssetReadUrl(row.outputAssetId);
    if (!url) {
      throw new Error(`Approved ${angle} asset not readable.`);
    }

    sources.push({
      angle,
      generationId: row.id,
      assetId: row.outputAssetId,
      imageUrl: url,
      archetypeId: row.archetypeId,
    });
  }

  return sources;
}

function buildRecolourPrompt(input: {
  colourwayName: string;
  fabricName: string;
  fabricComposition: string | null;
  hexApproximation: string | null;
}): string {
  const colour = input.hexApproximation?.trim() || input.colourwayName.trim();
  const fabric = [input.fabricName.trim(), input.fabricComposition?.trim()]
    .filter(Boolean)
    .join(", ");
  return (
    `Recolour the garment to ${colour} in ${fabric}. ` +
    "Preserve garment shape, silhouette, embroidery placement, lighting, and model identity exactly — " +
    "only change fabric colour and texture to match the target colourway."
  );
}

function buildManualStudioPrompt(input: {
  colourwayName: string;
  fabricName: string;
  fabricComposition: string | null;
  hexApproximation: string | null;
  backgroundPrompt: string | null;
  posePrompt: string | null;
}): string {
  const colour = input.hexApproximation?.trim() || input.fabricName.trim();
  const fabric = [input.fabricName.trim(), input.fabricComposition?.trim()]
    .filter(Boolean)
    .join(", ");
  const background =
    input.backgroundPrompt?.trim() ||
    "Soft outdoor daylight courtyard with warm stone, natural depth, and realistic shadows — not a flat paper studio.";

  return [
    "Photorealistic modest Pakistani women's fashion campaign photograph shot on a real camera.",
    `Garment colour and fabric: ${colour} in ${fabric}. Match the selected fabric name and swatch hue exactly for colour, weave, and drape.`,
    `Environment: ${background} Believable real location, natural lighting, not CGI, not illustration.`,
    "Model: young South Asian woman with a soft genuine closed-mouth smile, warm eyes, modest styling, and natural human micro-expression — not blank or mannequin-like.",
    "Preserve the exact garment design, cut, neckline, sleeves, hem, and embroidery from the reference image.",
    input.posePrompt?.trim(),
    "50–85mm lens look, sharp focus on garment texture, high-end commercial lookbook quality.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function buildColourwayPromptContext(
  designId: string,
  colourwayId: string,
  angle: RenderAngle,
  attemptN: number,
  options?: { manualStudio?: boolean; backgroundPrompt?: string | null; posePrompt?: string | null },
): Promise<ColourwayPromptContext> {
  const locked = options?.manualStudio
    ? await resolveManualReferenceSources(designId)
    : await resolveLockedGalleryAngles(designId);
  const source =
    locked.find((s) => s.angle === angle) ??
    locked.find((s) => s.angle === "FRONT") ??
    locked[0];
  if (!source) {
    throw new Error(`No locked source for angle ${angle}.`);
  }

  const [cw] = await db
    .select({
      id: colourways.id,
      name: colourways.name,
      hexApproximation: colourways.hexApproximation,
      fabricName: fabrics.name,
      composition: fabrics.composition,
    })
    .from(colourways)
    .innerJoin(fabrics, eq(colourways.fabricId, fabrics.id))
    .where(and(eq(colourways.id, colourwayId), eq(colourways.designId, designId)))
    .limit(1);
  if (!cw) {
    throw new Error("Colourway not found.");
  }

  const batchSeed = batchSeedFor(colourwayId, attemptN);
  const batchGroupId = `${colourwayId}:${attemptN}`;

  const prompt = options?.manualStudio
    ? buildManualStudioPrompt({
        colourwayName: cw.name,
        fabricName: cw.fabricName,
        fabricComposition: cw.composition,
        hexApproximation: cw.hexApproximation,
        backgroundPrompt: options.backgroundPrompt ?? null,
        posePrompt: options.posePrompt ?? null,
      })
    : buildRecolourPrompt({
        colourwayName: cw.name,
        fabricName: cw.fabricName,
        fabricComposition: cw.composition,
        hexApproximation: cw.hexApproximation,
      });

  return {
    angle,
    prompt,
    templateVersion: 1,
    sourceImageUrl: source.imageUrl,
    inputAssetIds: [source.assetId],
    parentGenerationId: options?.manualStudio ? null : source.generationId,
    colourwayId,
    batchSeed,
    batchGroupId,
  };
}

export async function buildColourwayBatchContexts(
  designId: string,
  colourwayId: string,
  attemptN: number,
  options?: {
    angles?: readonly RenderAngle[];
    posePrompt?: string | null;
    backgroundPrompt?: string | null;
    manualStudio?: boolean;
  },
): Promise<ColourwayPromptContext[]> {
  const angles = options?.angles?.length
    ? options.angles
    : GALLERY_ANGLES;
  const contexts = await Promise.all(
    angles.map((angle) =>
      buildColourwayPromptContext(designId, colourwayId, angle, attemptN, {
        manualStudio: options?.manualStudio,
        backgroundPrompt: options?.backgroundPrompt,
        posePrompt: options?.posePrompt,
      }),
    ),
  );
  if (options?.manualStudio) return contexts;
  const poseLine = options?.posePrompt?.trim();
  if (!poseLine) return contexts;
  return contexts.map((ctx) => ({
    ...ctx,
    prompt: `${ctx.prompt} ${poseLine} Keep the exact same garment design and the same model identity — only fabric colour and camera pose/angle may change.`,
  }));
}

export { GALLERY_ANGLES };

export function formatColourwayCostPreview(colourwayCount: number): string {
  if (colourwayCount <= 0) return "";
  const images = colourwayCount * 3;
  const costMicros = images * estimateCostUsdMicros("colourway", 1024, 1024);
  const costUsd = (costMicros / 1_000_000).toFixed(2);
  const noun = colourwayCount === 1 ? "colourway" : "colourways";
  return `${colourwayCount} ${noun} × 3 angles = ${images} images, ~$${costUsd}.`;
}
