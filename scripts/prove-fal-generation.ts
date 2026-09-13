import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Prove script — runs one live fal generation when FAL_KEY is set,
 * otherwise records a mock generation with cost/latency.
 *
 * Pricing sources (2026-07-25):
 * - https://fal.ai/models/fal-ai/flux-general/image-to-image
 * - https://fal.ai/models/fal-ai/flux/dev/image-to-image
 * - https://fal.ai/models/fal-ai/flux-2/turbo/edit
 */
async function main() {
  const { execSync } = await import("node:child_process");
  const {
    db,
    designGenerations,
    designs,
    garmentCategories,
    sql,
    studioSettings,
    STUDIO_SETTINGS_SINGLETON_ID,
  } = await import("@aks/db");
  const { uuidv7 } = await import("@aks/shared");
  const { enqueueDesignGeneration } = await import(
    "@/modules/ai/generation"
  );
  const { isFalConfigured } = await import("@/modules/ai/providers");
  const { buildSketchToPhotoPrompt } = await import("@/modules/ai/prompts");

  execSync("npx tsx scripts/ensure-studio-ai-models.ts", {
    stdio: "inherit",
    env: process.env,
  });

  const mode = isFalConfigured() ? "live-fal" : "mock";
  if (mode === "mock") {
    process.env.AI_GENERATION_MOCK = "1";
    console.log("[prove-fal] FAL_KEY absent — using mock generation");
  } else {
    console.log("[prove-fal] FAL_KEY present — live fal generation");
  }

  const categoryId = uuidv7();
  const designId = uuidv7();

  await db.insert(garmentCategories).values({
    id: categoryId,
    key: `prove-${Date.now()}`,
    name: "Prove Category",
    nameUr: "",
    measurementKeys: [],
    active: true,
    sortOrder: 999,
  });

  await db.insert(designs).values({
    id: designId,
    slug: `prove-design-${Date.now()}`,
    name: "Prove Design",
    garmentTypeId: categoryId,
  });

  const [settings] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  const { prompt, negative, templateVersion } = buildSketchToPhotoPrompt({
    garmentDescription: "Two-piece shalwar kameez with straight trouser.",
    shirtColour: "dusty rose",
    shirtFabric: "premium cotton lawn",
    trouserColour: "ivory",
    trouserFabric: "cotton cambric",
    embroideryDescription: "gold zari threadwork at neckline",
    angle: "front full length",
    houseModel: {
      buildDescription: "Balanced house default.",
      heightCm: 170,
      heightInches: 6700,
    },
    backdrop: settings?.backdropLightingProfile,
  });

  const sketchUrl =
    "https://raw.githubusercontent.com/CompVis/latent-diffusion/main/data/inpainting_examples/overture-creations-5sI6fQgYIuo.png";

  const { generationId, idempotencyKey } = await enqueueDesignGeneration({
    designId,
    stage: "HERO",
    promptJson: { prompt },
    negativePrompt: negative,
    templateVersion,
    sourceImageUrl: sketchUrl,
    attemptN: 1,
  });

  const { handleDesignGenerate } = await import(
    "@/modules/ai/generation/handler"
  );
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode,
        generationId,
        idempotencyKey,
        modelId: row.modelId,
        outputAssetId: row.outputAssetId,
        costUsd: row.costUsdMicros != null ? row.costUsdMicros / 1_000_000 : null,
        latencyMs: row.latencyMs,
      },
      null,
      2,
    ),
  );

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
