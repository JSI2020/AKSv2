import { eq } from "drizzle-orm";

import {
  db,
  houseModels,
  STUDIO_SETTINGS_SINGLETON_ID,
  studioSettings,
  type DefaultAiModelsMap,
} from "@aks/db";

import {
  ACTIVE_PROMPT_TEMPLATE_VERSION,
  DEFAULT_AI_MODEL_PLACEHOLDERS,
  DEFAULT_BACKDROP_LIGHTING_PROFILE,
} from "@/modules/ai";

export type StudioSettingsRow = typeof studioSettings.$inferSelect;

export async function ensureStudioSettingsRow(
  defaultArchetypeId: string | null,
): Promise<StudioSettingsRow> {
  const existing = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  if (existing[0]) return existing[0];

  const [inserted] = await db
    .insert(studioSettings)
    .values({
      id: STUDIO_SETTINGS_SINGLETON_ID,
      defaultArchetypeId,
      defaultBaseSizeLabel: "M",
      backdropLightingProfile: DEFAULT_BACKDROP_LIGHTING_PROFILE,
      defaultAiModels: DEFAULT_AI_MODEL_PLACEHOLDERS satisfies DefaultAiModelsMap,
      defaultLeadTimeDays: 21,
      defaultPriceTier: "standard",
      basePriceHintMinor: null,
      activePromptTemplateVersion: ACTIVE_PROMPT_TEMPLATE_VERSION,
      monthlySpendCapUsdCents: 50000,
    })
    .returning();

  if (!inserted) throw new Error("Failed to seed studio_settings");
  return inserted;
}

export async function seedStudioSettings(): Promise<void> {
  const [defaultModel] = await db
    .select({ id: houseModels.id })
    .from(houseModels)
    .where(eq(houseModels.isDefault, true))
    .limit(1);

  await ensureStudioSettingsRow(defaultModel?.id ?? null);
}
