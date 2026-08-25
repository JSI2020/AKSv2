import { asc, desc, eq } from "drizzle-orm";

import {
  db,
  PHOTOREAL_SETTINGS_SINGLETON_ID,
  photorealDesigns,
  photorealSettings,
  photorealVersions,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  DEFAULT_APP_SETTINGS,
  isFalModelKey,
  normalizeHouseModelSelection,
  type AppSettings,
} from "./settings";
import { DEFAULT_MODEL_PERSONA, HOUSE_MODELS } from "./model-persona";

export type PhotorealVersionRecord = {
  id: string;
  designId: string;
  parentVersionId: string | null;
  imageUrl: string;
  prompt: string;
  negativePrompt: string | null;
  seed: number | null;
  modelId: string;
  feedback: string | null;
  costUsd: number;
  costUsdMicros: number;
  requestId: string | null;
  createdAt: Date;
};

export type PhotorealDesignRecord = {
  id: string;
  title: string | null;
  description: string | null;
  shirtColour: string | null;
  trouserColour: string | null;
  fabric: string | null;
  sketchUrls: string[];
  oldDesignUrl: string | null;
  houseModelId: string | null;
  houseModelName: string | null;
  totalCost: number;
  totalCostUsdMicros: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PhotorealDesignWithVersions = PhotorealDesignRecord & {
  versions: PhotorealVersionRecord[];
};

export type SaveVersionInput = {
  id?: string;
  parentVersionId?: string | null;
  imageUrl: string;
  prompt: string;
  negativePrompt?: string | null;
  seed?: number | null;
  modelId: string;
  feedback?: string | null;
  costUsd: number;
  requestId?: string | null;
};

export type SaveDesignInput = {
  designId?: string;
  title?: string;
  description?: string;
  shirtColour?: string;
  trouserColour?: string;
  fabric?: string;
  sketchUrls: string[];
  oldDesignUrl?: string;
  houseModelId?: string;
  houseModelName?: string;
  createdById?: string | null;
  versions: SaveVersionInput[];
};

function usdToMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}

function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}

function rowToSettings(
  row: typeof photorealSettings.$inferSelect | undefined,
): AppSettings {
  if (!row) {
    return {
      ...DEFAULT_APP_SETTINGS,
      persona: { ...DEFAULT_MODEL_PERSONA },
      fal: { ...DEFAULT_APP_SETTINGS.fal },
    };
  }

  return {
    persona: {
      description: row.personaDescription || DEFAULT_MODEL_PERSONA.description,
      seed: row.personaSeed ?? DEFAULT_MODEL_PERSONA.seed,
      lockSeed: row.lockSeed,
    },
    preferredHouseModelId: normalizeHouseModelSelection(
      row.preferredHouseModelId,
    ),
    fal: {
      generateModel: isFalModelKey(row.generateModel)
        ? row.generateModel
        : DEFAULT_APP_SETTINGS.fal.generateModel,
      refineModel: isFalModelKey(row.refineModel)
        ? row.refineModel
        : DEFAULT_APP_SETTINGS.fal.refineModel,
    },
    monthlySpendReminderUsd:
      row.monthlySpendReminderUsdCents == null
        ? null
        : row.monthlySpendReminderUsdCents / 100,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const [row] = await db
    .select()
    .from(photorealSettings)
    .where(eq(photorealSettings.id, PHOTOREAL_SETTINGS_SINGLETON_ID))
    .limit(1);

  if (!row) {
    const defaults = rowToSettings(undefined);
    await upsertSettings(defaults);
    return defaults;
  }

  return rowToSettings(row);
}

export async function upsertSettings(next: AppSettings): Promise<AppSettings> {
  const normalized: AppSettings = {
    persona: {
      description:
        next.persona.description?.trim() || DEFAULT_MODEL_PERSONA.description,
      seed:
        typeof next.persona.seed === "number"
          ? next.persona.seed
          : DEFAULT_MODEL_PERSONA.seed,
      lockSeed:
        typeof next.persona.lockSeed === "boolean"
          ? next.persona.lockSeed
          : DEFAULT_MODEL_PERSONA.lockSeed,
    },
    preferredHouseModelId: normalizeHouseModelSelection(
      next.preferredHouseModelId,
    ),
    fal: {
      generateModel: isFalModelKey(next.fal.generateModel)
        ? next.fal.generateModel
        : DEFAULT_APP_SETTINGS.fal.generateModel,
      refineModel: isFalModelKey(next.fal.refineModel)
        ? next.fal.refineModel
        : DEFAULT_APP_SETTINGS.fal.refineModel,
    },
    monthlySpendReminderUsd:
      next.monthlySpendReminderUsd === undefined
        ? null
        : next.monthlySpendReminderUsd,
  };

  if (normalized.preferredHouseModelId !== "random") {
    const picked = HOUSE_MODELS.find(
      (m) => m.id === normalized.preferredHouseModelId,
    );
    if (picked) {
      normalized.persona = {
        description: picked.description,
        seed: picked.seed,
        lockSeed: picked.lockSeed,
      };
    }
  }

  const now = new Date();
  const values = {
    id: PHOTOREAL_SETTINGS_SINGLETON_ID,
    preferredHouseModelId: String(normalized.preferredHouseModelId),
    generateModel: normalized.fal.generateModel,
    refineModel: normalized.fal.refineModel,
    lockSeed: normalized.persona.lockSeed,
    monthlySpendReminderUsdCents:
      normalized.monthlySpendReminderUsd == null
        ? null
        : Math.round(normalized.monthlySpendReminderUsd * 100),
    personaDescription: normalized.persona.description,
    personaSeed: normalized.persona.seed,
    updatedAt: now,
  };

  await db
    .insert(photorealSettings)
    .values(values)
    .onConflictDoUpdate({
      target: photorealSettings.id,
      set: {
        preferredHouseModelId: values.preferredHouseModelId,
        generateModel: values.generateModel,
        refineModel: values.refineModel,
        lockSeed: values.lockSeed,
        monthlySpendReminderUsdCents: values.monthlySpendReminderUsdCents,
        personaDescription: values.personaDescription,
        personaSeed: values.personaSeed,
        updatedAt: now,
      },
    });

  return normalized;
}

function toDesignRecord(
  row: typeof photorealDesigns.$inferSelect,
): PhotorealDesignRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    shirtColour: row.shirtColour,
    trouserColour: row.trouserColour,
    fabric: row.fabric,
    sketchUrls: Array.isArray(row.sketchUrls) ? row.sketchUrls : [],
    oldDesignUrl: row.oldDesignUrl,
    houseModelId: row.houseModelId,
    houseModelName: row.houseModelName,
    totalCost: microsToUsd(row.totalCostUsdMicros),
    totalCostUsdMicros: row.totalCostUsdMicros,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVersionRecord(
  row: typeof photorealVersions.$inferSelect,
): PhotorealVersionRecord {
  return {
    id: row.id,
    designId: row.designId,
    parentVersionId: row.parentVersionId,
    imageUrl: row.imageUrl,
    prompt: row.prompt,
    negativePrompt: row.negativePrompt,
    seed: row.seed,
    modelId: row.modelId,
    feedback: row.feedback,
    costUsd: microsToUsd(row.costUsdMicros),
    costUsdMicros: row.costUsdMicros,
    requestId: row.requestId,
    createdAt: row.createdAt,
  };
}

export async function listDesigns(): Promise<
  Array<
    PhotorealDesignRecord & {
      coverUrl: string | null;
      versionCount: number;
    }
  >
> {
  const designs = await db
    .select()
    .from(photorealDesigns)
    .orderBy(desc(photorealDesigns.updatedAt));

  const result: Array<
    PhotorealDesignRecord & { coverUrl: string | null; versionCount: number }
  > = [];

  for (const d of designs) {
    const versions = await db
      .select()
      .from(photorealVersions)
      .where(eq(photorealVersions.designId, d.id))
      .orderBy(asc(photorealVersions.createdAt));

    result.push({
      ...toDesignRecord(d),
      coverUrl: versions.at(-1)?.imageUrl ?? null,
      versionCount: versions.length,
    });
  }

  return result;
}

export async function getDesignWithVersions(
  id: string,
): Promise<PhotorealDesignWithVersions | null> {
  const [design] = await db
    .select()
    .from(photorealDesigns)
    .where(eq(photorealDesigns.id, id))
    .limit(1);

  if (!design) return null;

  const versions = await db
    .select()
    .from(photorealVersions)
    .where(eq(photorealVersions.designId, id))
    .orderBy(asc(photorealVersions.createdAt));

  return {
    ...toDesignRecord(design),
    versions: versions.map(toVersionRecord),
  };
}

export async function saveDesign(
  input: SaveDesignInput,
): Promise<PhotorealDesignWithVersions> {
  if (!input.versions.length) {
    throw new Error("Cannot save a design with no versions.");
  }

  const now = new Date();
  const totalCostUsd = input.versions.reduce(
    (sum, v) => sum + (v.costUsd || 0),
    0,
  );
  const totalCostUsdMicros = usdToMicros(totalCostUsd);

  const existing = input.designId
    ? await getDesignWithVersions(input.designId)
    : null;
  const id = existing?.id ?? uuidv7();

  const title =
    input.title?.slice(0, 80) ||
    input.description?.slice(0, 80) ||
    existing?.title ||
    "Untitled design";

  const designValues = {
    id,
    title,
    description: input.description ?? existing?.description ?? null,
    shirtColour: input.shirtColour ?? existing?.shirtColour ?? null,
    trouserColour: input.trouserColour ?? existing?.trouserColour ?? null,
    fabric: input.fabric ?? existing?.fabric ?? null,
    sketchUrls: input.sketchUrls,
    oldDesignUrl: input.oldDesignUrl ?? existing?.oldDesignUrl ?? null,
    houseModelId: input.houseModelId ?? existing?.houseModelId ?? null,
    houseModelName: input.houseModelName ?? existing?.houseModelName ?? null,
    totalCostUsdMicros,
    createdById: input.createdById ?? existing?.createdById ?? null,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(photorealDesigns)
      .set({
        title: designValues.title,
        description: designValues.description,
        shirtColour: designValues.shirtColour,
        trouserColour: designValues.trouserColour,
        fabric: designValues.fabric,
        sketchUrls: designValues.sketchUrls,
        oldDesignUrl: designValues.oldDesignUrl,
        houseModelId: designValues.houseModelId,
        houseModelName: designValues.houseModelName,
        totalCostUsdMicros: designValues.totalCostUsdMicros,
        updatedAt: now,
      })
      .where(eq(photorealDesigns.id, id));

    await db
      .delete(photorealVersions)
      .where(eq(photorealVersions.designId, id));
  } else {
    await db.insert(photorealDesigns).values({
      ...designValues,
      createdAt: now,
    });
  }

  const versionRows = input.versions.map((v) => ({
    id: v.id || uuidv7(),
    designId: id,
    parentVersionId: v.parentVersionId ?? null,
    imageUrl: v.imageUrl,
    prompt: v.prompt,
    negativePrompt: v.negativePrompt ?? null,
    seed: v.seed ?? null,
    modelId: v.modelId,
    feedback: v.feedback ?? null,
    costUsdMicros: usdToMicros(v.costUsd),
    requestId: v.requestId ?? null,
    createdAt: now,
  }));

  if (versionRows.length) {
    await db.insert(photorealVersions).values(versionRows);
  }

  const saved = await getDesignWithVersions(id);
  if (!saved) throw new Error("Failed to reload saved design.");
  return saved;
}
