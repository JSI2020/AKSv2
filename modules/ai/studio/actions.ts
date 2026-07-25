"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  db,
  houseModels,
  insertAuditLog,
  STUDIO_SETTINGS_SINGLETON_ID,
  studioSettings,
  type DefaultAiModelsMap,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  ACTIVE_PROMPT_TEMPLATE_VERSION,
  DEFAULT_AI_MODEL_PLACEHOLDERS,
  ESTIMATED_COST_USD_MICROS,
  type AiJobType,
} from "@/modules/ai";
import { requirePermission } from "@/modules/auth";
import type { HouseModelRow } from "@/modules/sizing/fabric-archetype-actions";

import { ensureStudioSettingsRow } from "./defaults";

export type StudioSettingsRow = typeof studioSettings.$inferSelect;

export type StudioSettingsFormData = {
  settings: StudioSettingsRow;
  archetypes: HouseModelRow[];
  templateVersions: readonly number[];
  estimatedCostUsdMicros: Record<AiJobType, number>;
};

const AI_JOB_TYPES: readonly AiJobType[] = [
  "hero",
  "angle",
  "colourway",
  "draft",
];

function parseAiModels(formData: FormData): DefaultAiModelsMap | null {
  const out = { ...DEFAULT_AI_MODEL_PLACEHOLDERS };
  for (const key of AI_JOB_TYPES) {
    const value = String(formData.get(`model_${key}`) ?? "").trim();
    if (!value) return null;
    out[key] = value;
  }
  return out;
}

export async function getStudioSettingsFormData(): Promise<StudioSettingsFormData> {
  await requirePermission("settings.view");

  const [settingsRow] = await db
    .select()
    .from(studioSettings)
    .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
    .limit(1);

  const archetypes = await db
    .select()
    .from(houseModels)
    .where(eq(houseModels.active, true));

  const settings =
    settingsRow ??
    (await ensureStudioSettingsRow(
      archetypes.find((m) => m.isDefault)?.id ?? archetypes[0]?.id ?? null,
    ));

  return {
    settings,
    archetypes,
    templateVersions: [ACTIVE_PROMPT_TEMPLATE_VERSION],
    estimatedCostUsdMicros: ESTIMATED_COST_USD_MICROS,
  };
}

export async function saveStudioSettings(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("settings.edit");

    const defaultArchetypeId =
      String(formData.get("defaultArchetypeId") ?? "").trim() || null;
    const defaultBaseSizeLabel = String(
      formData.get("defaultBaseSizeLabel") ?? "M",
    ).trim();
    const backdropLightingProfile = String(
      formData.get("backdropLightingProfile") ?? "",
    ).trim();
    const defaultLeadTimeDays = Number.parseInt(
      String(formData.get("defaultLeadTimeDays") ?? ""),
      10,
    );
    const defaultPriceTier =
      String(formData.get("defaultPriceTier") ?? "").trim() || null;
    const basePriceHintRaw = String(
      formData.get("basePriceHintMinor") ?? "",
    ).trim();
    const basePriceHintMinor = basePriceHintRaw
      ? Number.parseInt(basePriceHintRaw, 10)
      : null;
    const activePromptTemplateVersion = Number.parseInt(
      String(formData.get("activePromptTemplateVersion") ?? "1"),
      10,
    );
    const monthlySpendCapRaw = String(
      formData.get("monthlySpendCapUsdCents") ?? "",
    ).trim();
    const monthlySpendCapUsdCents = monthlySpendCapRaw
      ? Number.parseInt(monthlySpendCapRaw, 10)
      : null;
    const defaultAiModels = parseAiModels(formData);

    if (
      !defaultBaseSizeLabel ||
      !backdropLightingProfile ||
      !Number.isInteger(defaultLeadTimeDays) ||
      defaultLeadTimeDays < 1 ||
      !Number.isInteger(activePromptTemplateVersion) ||
      activePromptTemplateVersion < 1 ||
      !defaultAiModels ||
      (basePriceHintMinor !== null && !Number.isInteger(basePriceHintMinor)) ||
      (monthlySpendCapUsdCents !== null &&
        !Number.isInteger(monthlySpendCapUsdCents))
    ) {
      return { ok: false, error: "Invalid input" };
    }

    if (defaultArchetypeId) {
      const [archetype] = await db
        .select({ id: houseModels.id })
        .from(houseModels)
        .where(eq(houseModels.id, defaultArchetypeId))
        .limit(1);
      if (!archetype) return { ok: false, error: "Archetype not found" };
    }

    const before = await db
      .select()
      .from(studioSettings)
      .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID))
      .limit(1);

    const values = {
      defaultArchetypeId,
      defaultBaseSizeLabel,
      backdropLightingProfile,
      defaultAiModels,
      defaultLeadTimeDays,
      defaultPriceTier,
      basePriceHintMinor,
      activePromptTemplateVersion,
      monthlySpendCapUsdCents,
      updatedAt: new Date(),
    };

    if (before[0]) {
      await db
        .update(studioSettings)
        .set(values)
        .where(eq(studioSettings.id, STUDIO_SETTINGS_SINGLETON_ID));
    } else {
      await db.insert(studioSettings).values({
        id: STUDIO_SETTINGS_SINGLETON_ID,
        ...values,
      });
    }

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      before: before[0] ?? null,
      after: values,
      action: "studio.settings.update",
      entityType: "studio_settings",
      entityId: STUDIO_SETTINGS_SINGLETON_ID,
    });

    revalidatePath("/admin/settings/studio");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}
