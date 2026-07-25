import { createHash } from "crypto";
import { and, desc, eq } from "drizzle-orm";

import {
  assets,
  colourways,
  db,
  designGenerations,
  designLocks,
  fabrics,
} from "@aks/db";
import type { RenderAngle } from "@aks/shared";
import { estimateCostUsdMicros } from "@/modules/ai/providers/fal-models";

import { createPresignedReadUrl } from "@/modules/platform/assets";

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
  parentGenerationId: string;
  colourwayId: string;
  batchSeed: number;
  batchGroupId: string;
};

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
  return createPresignedReadUrl(asset.r2Key, 3600);
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

export async function buildColourwayPromptContext(
  designId: string,
  colourwayId: string,
  angle: RenderAngle,
  attemptN: number,
): Promise<ColourwayPromptContext> {
  const locked = await resolveLockedGalleryAngles(designId);
  const source = locked.find((s) => s.angle === angle);
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

  return {
    angle,
    prompt: buildRecolourPrompt({
      colourwayName: cw.name,
      fabricName: cw.fabricName,
      fabricComposition: cw.composition,
      hexApproximation: cw.hexApproximation,
    }),
    templateVersion: 1,
    sourceImageUrl: source.imageUrl,
    inputAssetIds: [source.assetId],
    parentGenerationId: source.generationId,
    colourwayId,
    batchSeed,
    batchGroupId,
  };
}

export async function buildColourwayBatchContexts(
  designId: string,
  colourwayId: string,
  attemptN: number,
): Promise<ColourwayPromptContext[]> {
  return Promise.all(
    GALLERY_ANGLES.map((angle) =>
      buildColourwayPromptContext(designId, colourwayId, angle, attemptN),
    ),
  );
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
