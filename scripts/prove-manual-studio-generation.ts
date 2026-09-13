import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * End-to-end prove for Design Photos manual studio path (live fal):
 * reference asset → COLOURWAY job → design_renders promote.
 *
 * Requires: DATABASE_URL, FAL_KEY, R2_*, AI_GENERATION_MOCK=0
 */
async function main() {
  const { execSync } = await import("node:child_process");
  execSync("npx tsx scripts/ensure-studio-ai-models.ts", {
    stdio: "inherit",
    env: process.env,
  });

  const { isFalConfigured } = await import("@/modules/ai/providers");
  if (!isFalConfigured()) {
    throw new Error("FAL_KEY is required with AI_GENERATION_MOCK=0");
  }
  if (process.env.AI_GENERATION_MOCK === "1") {
    throw new Error("Set AI_GENERATION_MOCK=0 for live fal testing");
  }

  const {
    colourways,
    db,
    designGenerations,
    designRenders,
    designs,
    fabrics,
    garmentCategories,
    sql,
  } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");
  const { eq } = await import("drizzle-orm");
  const { completeUpload, createPresignedReadUrl, uploadBufferToR2 } =
    await import("@/modules/platform/assets");
  const { MOCK_PNG_BASE64 } = await import("@/modules/ai/providers/mock");
  const { enqueueDesignGeneration } = await import(
    "@/modules/ai/generation/enqueue"
  );
  const { handleDesignGenerate } = await import(
    "@/modules/ai/generation/handler"
  );
  const { buildColourwayPromptContext } = await import(
    "@/modules/ai/studio/colourway-prompt"
  );
  const { promoteManualStudioGeneration } = await import(
    "@/modules/designs/manual-studio-promote"
  );
  const { resolveStudioBackgroundPrompt } = await import(
    "@/modules/designs/studio-backgrounds"
  );
  const { assets } = await import("@aks/db");

  const { asc } = await import("drizzle-orm");

  let categoryId: string;
  const [existingCat] = await db
    .select({ id: garmentCategories.id })
    .from(garmentCategories)
    .where(eq(garmentCategories.key, "KAMEEZ"))
    .limit(1);
  if (existingCat) {
    categoryId = existingCat.id;
  } else {
    categoryId = uuidv7();
    await db.insert(garmentCategories).values({
      id: categoryId,
      key: "KAMEEZ",
      name: "Prove Kameez",
      nameUr: "",
      measurementKeys: [],
      active: true,
      sortOrder: 998,
    });
  }

  const designId = uuidv7();
  const fabricId = uuidv7();

  const colourwayId = uuidv7();

  await db.insert(fabrics).values({
    id: fabricId,
    name: "Prove Russian Silk",
    composition: "Silk",
    widthInches: 4500,
    costPerMeterMinor: 500000,
    active: true,
  });

  await db.insert(designs).values({
    id: designId,
    slug: `prove-manual-${Date.now()}`,
    name: "Prove Manual Studio",
    garmentTypeId: categoryId,
    components: ["KAMEEZ"],
    status: "DRAFT",
  });

  await db.insert(colourways).values({
    id: colourwayId,
    designId,
    name: "Prove Russian Silk",
    slug: "prove-russian-silk",
    fabricId,
    pieceFabrics: { KAMEEZ: fabricId },
    isDefault: true,
    sortOrder: 0,
    active: true,
  });

  const refBody = Buffer.from(MOCK_PNG_BASE64, "base64");
  const { key: refKey } = await uploadBufferToR2({
    body: refBody,
    mime: "image/png",
    keyPrefix: "prove/manual-studio",
  });
  const refAsset = await completeUpload({
    key: refKey,
    mime: "image/png",
    isAiGenerated: false,
  });

  await db.insert(designRenders).values({
    id: uuidv7(),
    designId,
    colourwayId,
    angle: "FRONT",
    assetId: refAsset.id,
    isAiGenerated: false,
    altText: "Reference",
    sortOrder: 0,
  });

  const backgroundPrompt = resolveStudioBackgroundPrompt({
    presetId: "courtyard",
    custom: "",
  });
  const ctx = await buildColourwayPromptContext(
    designId,
    colourwayId,
    "FRONT",
    1,
    {
      manualStudio: true,
      backgroundPrompt,
      posePrompt:
        "Pose: facing camera but relaxed, soft knee bend, natural arm placement — real commercial photography.",
    },
  );

  console.log("[prove-manual-studio] enqueue COLOURWAY / FRONT (live fal)…");
  const { generationId } = await enqueueDesignGeneration({
    designId,
    stage: "COLOURWAY",
    angle: "FRONT",
    colourwayId,
    promptJson: {
      prompt: ctx.prompt,
      batchGroupId: ctx.batchGroupId,
      manualStudio: true,
    },
    templateVersion: ctx.templateVersion,
    inputAssetIds: ctx.inputAssetIds,
    sourceImageUrl: ctx.sourceImageUrl,
    seed: ctx.batchSeed,
    attemptN: 1,
    skipHeroLock: true,
    manualStudio: true,
  });

  await handleDesignGenerate({ generationId });

  const [row] = await db
    .select()
    .from(designGenerations)
    .where(eq(designGenerations.id, generationId))
    .limit(1);

  if (!row || row.status !== "SUCCEEDED" || !row.outputAssetId) {
    throw new Error(
      `Generation failed: ${row?.error ?? "unknown"} (status=${row?.status})`,
    );
  }

  await promoteManualStudioGeneration(row);

  const aiRenders = await db
    .select({
      angle: designRenders.angle,
      assetId: designRenders.assetId,
      isAiGenerated: designRenders.isAiGenerated,
    })
    .from(designRenders)
    .where(eq(designRenders.designId, designId));

  let previewUrl: string | null = null;
  if (row.outputAssetId) {
    const [asset] = await db
      .select({ r2Key: assets.r2Key })
      .from(assets)
      .where(eq(assets.id, row.outputAssetId))
      .limit(1);
    if (asset) previewUrl = await createPresignedReadUrl(asset.r2Key, 3600);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        designId,
        generationId,
        modelId: row.modelId,
        costUsd:
          row.costUsdMicros != null ? row.costUsdMicros / 1_000_000 : null,
        latencyMs: row.latencyMs,
        previewUrl,
        renders: aiRenders,
      },
      null,
      2,
    ),
  );

  const aiFront = aiRenders.filter(
    (r) => r.isAiGenerated && r.angle === "FRONT",
  );
  if (aiFront.length < 1) {
    throw new Error("Expected AI FRONT render on design_renders");
  }

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
