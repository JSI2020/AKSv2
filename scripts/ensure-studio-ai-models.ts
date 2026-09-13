import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Idempotent — studio_settings must list verified fal models before any live generation. */
async function main() {
  const { seedStudioSettings } = await import(
    "@/modules/ai/studio/defaults"
  );
  const {
    db,
    studioSettings,
    STUDIO_SETTINGS_SINGLETON_ID,
    sql,
  } = await import("@aks/db");
  const { eq } = await import("drizzle-orm");
  const { VERIFIED_FAL_MODELS } = await import("@/modules/ai/providers/fal-models");

  await seedStudioSettings();

  const [row] = await db
    .select({ defaultAiModels: studioSettings.defaultAiModels })
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  const current = (row?.defaultAiModels ?? {}) as Record<string, string>;
  const missing = Object.entries(VERIFIED_FAL_MODELS).filter(
    ([key, model]) => !current[key]?.trim() || current[key] !== model,
  );

  if (missing.length > 0) {
    await db
      .update(studioSettings)
      .set({
        defaultAiModels: { ...VERIFIED_FAL_MODELS, ...current },
        updatedAt: new Date(),
      })
      .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID));
    console.log(
      `[ensure-studio-ai-models] updated ${missing.length} model slot(s): ${missing.map(([k]) => k).join(", ")}`,
    );
  } else {
    console.log("[ensure-studio-ai-models] OK — verified fal models present.");
  }

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
