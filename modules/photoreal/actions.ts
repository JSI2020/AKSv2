"use server";

import { uuidv7 } from "@aks/shared";
import { db, insertAuditLog } from "@aks/db";
import type { GarmentChartRow } from "@/modules/sizing/garment-size-guide/types";
import { pomKeyToMeasurementKey } from "@/modules/sizing/garment-size-guide/measurement-pom-map";

import { getUsdPkrRate, usdToPkr } from "./currency";
import { polishUserPrompt } from "./providers/deepseek";
import {
  generateFromSketch,
  generateFromText,
  refineImage,
  uploadToFal,
} from "./providers/fal-photoreal";
import {
  DEFAULT_HOUSE_MODEL,
  getHouseModelById,
  HOUSE_MODELS,
  houseModelToPersona,
  resolveHouseModel,
  type HouseModelSelection,
} from "./model-persona";
import {
  buildPrompt,
  feedbackRequestsBackground,
  feedbackRequestsPose,
  resolvePromptMode,
  type PromptMode,
} from "./prompt-builder";
import {
  DEFAULT_APP_SETTINGS,
  isFalModelKey,
  normalizeHouseModelSelection,
  type AppSettings,
} from "./settings";
import {
  FABRIC_OUTPUT_LABELS,
  fabricCataloguePrompt,
  fabricPrompt,
  HOUSE_FABRIC_COLORWAYS,
  spiralDrapePrompt,
  type FabricOutputKind,
} from "./fabric-studio";
import {
  getDesignWithVersions,
  getSettings,
  listDesigns,
  saveDesign,
  upsertSettings,
  type SaveDesignInput,
} from "./store";
import { resolveStudioBackgroundPrompt } from "@/modules/designs/studio-backgrounds";

type ActionError = { ok: false; error: string; modelId?: string };
type ActionOk<T> = { ok: true } & T;

async function requirePhotoreal(
  permission: "photoreal.view" | "photoreal.generate" | "photoreal.edit",
) {
  const { requirePermission } = await import("@/modules/auth");
  return requirePermission(permission);
}

export type PhotorealUploadResult =
  | ActionOk<{
      files: Array<{
        originalName: string;
        url: string;
        width: number;
        height: number;
      }>;
    }>
  | ActionError;

export async function uploadPhotorealFilesAction(
  formData: FormData,
): Promise<PhotorealUploadResult> {
  try {
    await requirePhotoreal("photoreal.generate");

    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File);
    const kind = String(formData.get("kind") ?? "sketch");

    if (!files.length) {
      return { ok: false, error: "No files uploaded." };
    }

    const uploaded: Array<{
      originalName: string;
      url: string;
      width: number;
      height: number;
    }> = [];

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const blob = new File(
        [new Uint8Array(bytes)],
        file.name || (kind === "old-design" ? "old-design.png" : "sketch.png"),
        { type: file.type || "image/png" },
      );
      const url = await uploadToFal(blob);
      uploaded.push({
        originalName: file.name,
        url,
        width: 0,
        height: 0,
      });
    }

    return { ok: true, files: uploaded };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return { ok: false, error: message };
  }
}

export type GeneratePhotorealPayload = {
  sketchUrls?: string[];
  oldDesignUrl?: string;
  oldDesignUrls?: string[];
  description?: string;
  shirtColour?: string;
  trouserColour?: string;
  fabric?: string;
  houseModelId?: HouseModelSelection;
  sourceMode?: PromptMode;
  poseId?: string | null;
  backgroundPreset?: string | null;
  backgroundCustom?: string | null;
};

export type PhotorealVersionDto = {
  id: string;
  parentVersionId: string | null;
  imageUrl: string;
  prompt: string;
  negativePrompt: string;
  seed: number | null;
  modelId: string;
  feedback: string | null;
  costUsd: number;
  requestId: string;
};

export type GeneratePhotorealResult =
  | ActionOk<{
      version: PhotorealVersionDto;
      costUsd: number;
      costPkr: number;
      totalCost: number;
      totalCostPkr: number;
      usdPkrRate: number;
      modelId: string;
      promptMode: PromptMode;
      pose?: { id: string; label: string };
      houseModel: {
        id: string;
        name: string;
        cue: string;
        seed: number;
      };
      promptPolish: {
        polished: boolean;
        model?: string;
        description?: string;
        shirtColour?: string;
        trouserColour?: string;
        fabric?: string;
        warning?: string;
      };
    }>
  | ActionError;

export async function generatePhotorealAction(
  payload: GeneratePhotorealPayload,
): Promise<GeneratePhotorealResult> {
  try {
    await requirePhotoreal("photoreal.generate");

    const sketchOnly = (payload.sketchUrls ?? []).filter(Boolean);
    const oldDesigns = [
      ...(payload.oldDesignUrls ?? []),
      ...(payload.oldDesignUrl ? [payload.oldDesignUrl] : []),
    ].filter(Boolean);
    const oldOnly = [...new Set(oldDesigns)];
    const hasDescription = Boolean(payload.description?.trim());

    const mode = resolvePromptMode({
      sketchUrls: sketchOnly,
      oldDesignUrl: oldOnly[0],
      oldDesignUrls: oldOnly,
      sourceMode: payload.sourceMode,
      hasDescription,
    });

    if (mode === "description" && !hasDescription) {
      return {
        ok: false,
        error:
          "Description mode needs a written description. Colours and fabric are optional.",
      };
    }
    if (mode === "sketch" && !sketchOnly.length) {
      return { ok: false, error: "Upload at least one sketch." };
    }
    if (mode === "old-design" && !oldOnly.length) {
      return { ok: false, error: "Upload at least one old design photo." };
    }

    const imageUrls =
      mode === "old-design" ? oldOnly : mode === "sketch" ? sketchOnly : [];

    let settings = DEFAULT_APP_SETTINGS;
    try {
      settings = await getSettings();
    } catch (err) {
      console.warn("[photoreal/generate] settings failed, using defaults:", err);
    }

    const houseModel = resolveHouseModel(
      payload.houseModelId ?? settings.preferredHouseModelId,
    );
    const persona = houseModelToPersona(houseModel);

    const polished = await polishUserPrompt({
      description: payload.description,
      shirtColour: payload.shirtColour,
      trouserColour: payload.trouserColour,
      fabric: payload.fabric,
      mode: "generate",
      inputMode: mode,
    });

    const backgroundPrompt = resolveStudioBackgroundPrompt({
      presetId: payload.backgroundPreset,
      custom: payload.backgroundCustom,
    });

    const built = buildPrompt({
      description: polished.description,
      shirtColour: polished.shirtColour,
      trouserColour: polished.trouserColour,
      fabric: polished.fabric,
      persona,
      mode,
      poseId: payload.poseId,
      backgroundPrompt,
    });

    const result =
      mode === "description"
        ? await generateFromText({
            prompt: built.prompt,
            negativePrompt: built.negativePrompt,
            seed: built.seed,
          })
        : await generateFromSketch(
            {
              sketchUrls: imageUrls,
              prompt: built.prompt,
              negativePrompt: built.negativePrompt,
              seed: built.seed,
              modelKey: settings.fal.generateModel,
              strength: mode === "old-design" ? 0.82 : undefined,
            },
            settings.fal,
          );

    if (!result.ok) {
      return { ok: false, error: result.error, modelId: result.modelId };
    }

    const version: PhotorealVersionDto = {
      id: uuidv7(),
      parentVersionId: null,
      imageUrl: result.imageUrl,
      prompt: built.prompt,
      negativePrompt: built.negativePrompt,
      seed: result.seed ?? null,
      modelId: result.modelId,
      feedback: null,
      costUsd: result.costUsd,
      requestId: result.requestId,
    };

    const rate = getUsdPkrRate();
    const costPkr = usdToPkr(result.costUsd);

    return {
      ok: true,
      version,
      costUsd: result.costUsd,
      costPkr,
      totalCost: result.costUsd,
      totalCostPkr: costPkr,
      usdPkrRate: rate,
      modelId: result.modelId,
      promptMode: mode,
      pose: built.poseId
        ? { id: built.poseId, label: built.poseLabel ?? built.poseId }
        : undefined,
      houseModel: {
        id: houseModel.id,
        name: houseModel.name,
        cue: houseModel.cue,
        seed: houseModel.seed,
      },
      promptPolish: {
        polished: polished.polished,
        model: polished.model,
        description: polished.description,
        shirtColour: polished.shirtColour,
        trouserColour: polished.trouserColour,
        fabric: polished.fabric,
        warning: polished.error,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    console.error("[photoreal/generate]", err);
    return { ok: false, error: message };
  }
}

export type RefinePhotorealPayload = {
  baseImageUrl: string;
  sketchUrls?: string[];
  oldDesignUrl?: string;
  parentVersionId?: string;
  description?: string;
  shirtColour?: string;
  trouserColour?: string;
  fabric?: string;
  feedback?: string;
  previousTotalCost?: number;
  houseModelId?: string;
  promptMode?: PromptMode;
  poseId?: string | null;
  backgroundPreset?: string | null;
  backgroundCustom?: string | null;
};

export type RefinePhotorealResult =
  | ActionOk<{
      version: PhotorealVersionDto;
      costUsd: number;
      costPkr: number;
      totalCost: number;
      totalCostPkr: number;
      usdPkrRate: number;
      modelId: string;
      promptMode: PromptMode;
      houseModel: {
        id: string;
        name: string;
        cue: string;
        seed: number;
      };
      promptPolish: {
        polished: boolean;
        model?: string;
        feedback?: string;
        warning?: string;
      };
    }>
  | ActionError;

export async function refinePhotorealAction(
  payload: RefinePhotorealPayload,
): Promise<RefinePhotorealResult> {
  try {
    await requirePhotoreal("photoreal.generate");

    if (!payload.baseImageUrl) {
      return { ok: false, error: "baseImageUrl is required." };
    }

    const mode: PromptMode =
      payload.promptMode ??
      resolvePromptMode({
        sketchUrls: payload.sketchUrls,
        oldDesignUrl: payload.oldDesignUrl,
      });

    const houseModel =
      (payload.houseModelId && getHouseModelById(payload.houseModelId)) ||
      DEFAULT_HOUSE_MODEL;
    const persona = houseModelToPersona(houseModel);

    const polished = await polishUserPrompt({
      description: payload.description,
      shirtColour: payload.shirtColour,
      trouserColour: payload.trouserColour,
      fabric: payload.fabric,
      feedback: payload.feedback,
      mode: "refine",
      inputMode: mode,
    });

    const backgroundPrompt = resolveStudioBackgroundPrompt({
      presetId: payload.backgroundPreset,
      custom: payload.backgroundCustom,
    });

    const settings = await getSettings();
    const built = buildPrompt({
      description: polished.description,
      shirtColour: polished.shirtColour,
      trouserColour: polished.trouserColour,
      fabric: polished.fabric,
      feedback: polished.feedback,
      persona,
      mode,
      poseId: payload.poseId,
      backgroundPrompt,
      keepPose:
        !payload.poseId && !feedbackRequestsPose(polished.feedback ?? ""),
    });

    const referenceUrls =
      mode === "sketch" ? (payload.sketchUrls ?? []).slice(0, 2) : [];

    const bigSceneChange =
      feedbackRequestsBackground(polished.feedback ?? payload.feedback) ||
      feedbackRequestsPose(polished.feedback ?? payload.feedback);

    let strength = mode === "sketch" ? 0.55 : 0.72;
    if (bigSceneChange) {
      strength = mode === "sketch" ? 0.78 : 0.84;
    }

    const result = await refineImage(
      {
        baseImageUrl: payload.baseImageUrl,
        referenceUrls,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed: built.seed,
        modelKey: settings.fal.refineModel,
        strength,
      },
      settings.fal,
    );

    if (!result.ok) {
      return { ok: false, error: result.error, modelId: result.modelId };
    }

    const version: PhotorealVersionDto = {
      id: uuidv7(),
      parentVersionId: payload.parentVersionId ?? null,
      imageUrl: result.imageUrl,
      prompt: built.prompt,
      negativePrompt: built.negativePrompt,
      seed: result.seed ?? null,
      modelId: result.modelId,
      feedback: polished.feedback ?? payload.feedback ?? null,
      costUsd: result.costUsd,
      requestId: result.requestId,
    };

    const totalCost = (payload.previousTotalCost ?? 0) + result.costUsd;
    const rate = getUsdPkrRate();

    return {
      ok: true,
      version,
      costUsd: result.costUsd,
      costPkr: usdToPkr(result.costUsd),
      totalCost,
      totalCostPkr: usdToPkr(totalCost),
      usdPkrRate: rate,
      modelId: result.modelId,
      promptMode: mode,
      houseModel: {
        id: houseModel.id,
        name: houseModel.name,
        cue: houseModel.cue,
        seed: houseModel.seed,
      },
      promptPolish: {
        polished: polished.polished,
        model: polished.model,
        feedback: polished.feedback,
        warning: polished.error,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refine failed.";
    return { ok: false, error: message };
  }
}

export type SavePhotorealDesignPayload = SaveDesignInput & {
  personaJson?: string;
};

export async function savePhotorealDesignAction(
  payload: SavePhotorealDesignPayload,
): Promise<
  | ActionOk<{
      designId: string;
      saved: true;
      totalCost: number;
      totalCostPkr: number;
      versionCount: number;
    }>
  | ActionError
> {
  try {
    const session = await requirePhotoreal("photoreal.edit");

    if (!payload.versions?.length) {
      return {
        ok: false,
        error: "Nothing to save — generate at least one version first.",
      };
    }

    let houseModelId = payload.houseModelId;
    let houseModelName = payload.houseModelName;
    if (payload.personaJson && (!houseModelId || !houseModelName)) {
      try {
        const parsed = JSON.parse(payload.personaJson) as {
          houseModelId?: string;
          houseModelName?: string;
        };
        houseModelId = houseModelId ?? parsed.houseModelId;
        houseModelName = houseModelName ?? parsed.houseModelName;
      } catch {
        /* ignore */
      }
    }

    const saved = await saveDesign({
      designId: payload.designId,
      title: payload.title,
      description: payload.description,
      shirtColour: payload.shirtColour,
      trouserColour: payload.trouserColour,
      fabric: payload.fabric,
      sketchUrls: payload.sketchUrls ?? [],
      oldDesignUrl: payload.oldDesignUrl,
      houseModelId,
      houseModelName,
      createdById: session.user.id,
      versions: payload.versions,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role ?? null,
      action: "photoreal.design.save",
      entityType: "photoreal_design",
      entityId: saved.id,
      before: null,
      after: {
        title: saved.title,
        versionCount: saved.versions.length,
        totalCostUsdMicros: saved.totalCostUsdMicros,
      },
    });

    return {
      ok: true,
      designId: saved.id,
      saved: true,
      totalCost: saved.totalCost,
      totalCostPkr: usdToPkr(saved.totalCost),
      versionCount: saved.versions.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return { ok: false, error: message };
  }
}

export async function listPhotorealDesignsAction(): Promise<
  | ActionOk<{
      designs: Array<{
        id: string;
        title: string | null;
        description: string | null;
        totalCost: number;
        totalCostPkr: number;
        versionCount: number;
        coverUrl: string | null;
        updatedAt: string;
        sketchUrls: string[];
      }>;
      usdPkrRate: number;
    }>
  | ActionError
> {
  try {
    await requirePhotoreal("photoreal.view");
    const rate = getUsdPkrRate();
    const designs = await listDesigns();
    return {
      ok: true,
      designs: designs.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        totalCost: d.totalCost,
        totalCostPkr: usdToPkr(d.totalCost),
        versionCount: d.versionCount,
        coverUrl: d.coverUrl,
        updatedAt: d.updatedAt.toISOString(),
        sketchUrls: d.sketchUrls,
      })),
      usdPkrRate: rate,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load gallery.";
    return { ok: false, error: message };
  }
}

export async function getPhotorealDesignAction(id: string): Promise<
  | ActionOk<{
      id: string;
      title: string | null;
      description: string | null;
      shirtColour: string | null;
      trouserColour: string | null;
      fabric: string | null;
      oldDesignUrl: string | null;
      houseModelId: string | null;
      houseModelName: string | null;
      sketchUrls: string[];
      totalCost: number;
      totalCostPkr: number;
      usdPkrRate: number;
      versions: Array<{
        id: string;
        parentVersionId: string | null;
        imageUrl: string;
        prompt: string;
        negativePrompt: string | null;
        seed: number | null;
        modelId: string;
        feedback: string | null;
        costUsd: number;
        requestId: string | null;
        createdAt: string;
      }>;
    }>
  | ActionError
> {
  try {
    await requirePhotoreal("photoreal.view");
    const design = await getDesignWithVersions(id);
    if (!design) {
      return { ok: false, error: "Design not found." };
    }
    const rate = getUsdPkrRate();
    return {
      ok: true,
      id: design.id,
      title: design.title,
      description: design.description,
      shirtColour: design.shirtColour,
      trouserColour: design.trouserColour,
      fabric: design.fabric,
      oldDesignUrl: design.oldDesignUrl,
      houseModelId: design.houseModelId,
      houseModelName: design.houseModelName,
      sketchUrls: design.sketchUrls,
      totalCost: design.totalCost,
      totalCostPkr: usdToPkr(design.totalCost),
      usdPkrRate: rate,
      versions: design.versions.map((v) => ({
        id: v.id,
        parentVersionId: v.parentVersionId,
        imageUrl: v.imageUrl,
        prompt: v.prompt,
        negativePrompt: v.negativePrompt,
        seed: v.seed,
        modelId: v.modelId,
        feedback: v.feedback,
        costUsd: v.costUsd,
        requestId: v.requestId,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load design.";
    return { ok: false, error: message };
  }
}

export async function getPhotorealSettingsAction(): Promise<
  | ActionOk<
      AppSettings & {
        houseModels: Array<{ id: string; name: string; cue: string }>;
      }
    >
  | ActionError
> {
  try {
    await requirePhotoreal("photoreal.view");
    const settings = await getSettings();
    return {
      ok: true,
      ...settings,
      houseModels: HOUSE_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        cue: m.cue,
      })),
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load settings.";
    return { ok: false, error: message };
  }
}

export async function savePhotorealSettingsAction(
  body: Partial<AppSettings> & {
    persona?: Partial<AppSettings["persona"]>;
    fal?: Partial<AppSettings["fal"]>;
  },
): Promise<ActionOk<AppSettings> | ActionError> {
  try {
    const session = await requirePhotoreal("photoreal.edit");
    const current = await getSettings();

    const next: AppSettings = {
      persona: {
        description:
          body.persona?.description?.trim() || current.persona.description,
        seed:
          typeof body.persona?.seed === "number"
            ? body.persona.seed
            : current.persona.seed,
        lockSeed:
          typeof body.persona?.lockSeed === "boolean"
            ? body.persona.lockSeed
            : current.persona.lockSeed,
      },
      preferredHouseModelId: normalizeHouseModelSelection(
        body.preferredHouseModelId ?? current.preferredHouseModelId,
      ),
      fal: {
        generateModel:
          body.fal?.generateModel && isFalModelKey(body.fal.generateModel)
            ? body.fal.generateModel
            : current.fal.generateModel,
        refineModel:
          body.fal?.refineModel && isFalModelKey(body.fal.refineModel)
            ? body.fal.refineModel
            : current.fal.refineModel,
      },
      monthlySpendReminderUsd:
        body.monthlySpendReminderUsd === undefined
          ? current.monthlySpendReminderUsd
          : body.monthlySpendReminderUsd,
    };

    if (next.preferredHouseModelId !== "random") {
      const picked = HOUSE_MODELS.find(
        (m) => m.id === next.preferredHouseModelId,
      );
      if (picked) {
        next.persona = {
          description: picked.description,
          seed: picked.seed,
          lockSeed: picked.lockSeed,
        };
      }
    }

    const saved = await upsertSettings(next);

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role ?? null,
      action: "photoreal.settings.update",
      entityType: "photoreal_settings",
      entityId: "01900000-0000-7000-8000-000000000003",
      before: current,
      after: saved,
    });

    return { ok: true, ...saved };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save settings.";
    return { ok: false, error: message };
  }
}

type FabricPhotoResult =
  | ActionOk<{
      images: Array<{
        id: string;
        kind: FabricOutputKind;
        label: string;
        imageUrl: string;
      }>;
      costUsd: number;
    }>
  | ActionError;

/** One catalogue photograph — same colour and weave as the uploaded swatch. */
export async function generateFabricPhotoAction(payload: {
  swatchUrl: string;
  lighting?: string;
  background?: string;
}): Promise<
  | ActionOk<{ id: string; imageUrl: string; costUsd: number }>
  | ActionError
> {
  try {
    await requirePhotoreal("photoreal.generate");

    if (!payload.swatchUrl?.trim()) {
      return { ok: false, error: "Upload a fabric photo first." };
    }

    const {
      describeFabricSwatch,
      generateFabricCataloguePhoto,
    } = await import("./providers/fabric-fal");

    const swatchDescription = await describeFabricSwatch(payload.swatchUrl);

    const prompt = fabricCataloguePrompt({
      lighting: payload.lighting ?? "Even daylight",
      background: payload.background ?? "Neutral grey",
      swatchDescription,
    });

    const imageUrl = await generateFabricCataloguePhoto(
      payload.swatchUrl,
      prompt,
    );
    if (!imageUrl) {
      return { ok: false, error: "Could not generate fabric photograph." };
    }

    return { ok: true, id: uuidv7(), imageUrl, costUsd: 0.04 };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Fabric generation failed.";
    return { ok: false, error: message };
  }
}

export async function generateFabricPhotosAction(payload: {
  swatchUrl: string;
  swatchFile?: File;
  outputs: FabricOutputKind[];
  garment: string;
  lighting: string;
  background: string;
}): Promise<FabricPhotoResult> {
  try {
    await requirePhotoreal("photoreal.generate");

    if (!payload.outputs.length) {
      return { ok: false, error: "Pick at least one way to show it." };
    }
    if (!payload.swatchUrl && !payload.swatchFile) {
      return { ok: false, error: "Upload a fabric photo first." };
    }

    const { renderFalEdit, renderFalEditFromUrl } = await import(
      "@/modules/dress-sizing/providers/fal"
    );

    const file =
      payload.swatchFile ??
      (payload.swatchUrl
        ? null
        : await (async () => {
            const res = await fetch(payload.swatchUrl);
            const buf = await res.arrayBuffer();
            return new File([buf], "swatch.png", { type: "image/png" });
          })());

    const images: Array<{
      id: string;
      kind: FabricOutputKind;
      label: string;
      imageUrl: string;
    }> = [];
    let costUsd = 0;

    for (const kind of payload.outputs) {
      const prompt = fabricPrompt(kind, {
        garment: payload.garment,
        lighting: payload.lighting,
        background: payload.background,
      });
      const imageUrl = payload.swatchUrl
        ? await renderFalEditFromUrl(payload.swatchUrl, prompt)
        : file
          ? await renderFalEdit(file, prompt)
          : null;
      if (!imageUrl) {
        return { ok: false, error: `Could not generate ${kind} view.` };
      }
      images.push({
        id: uuidv7(),
        kind,
        label: FABRIC_OUTPUT_LABELS[kind],
        imageUrl,
      });
      costUsd += 0.04;
    }

    return { ok: true, images, costUsd };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Fabric generation failed.";
    return { ok: false, error: message };
  }
}

type FabricColourwaySheetResult =
  | ActionOk<{
      images: Array<{ id: string; label: string; imageUrl: string }>;
      costUsd: number;
    }>
  | ActionError;

export async function generateFabricColourwayTileAction(payload: {
  swatchUrl: string;
  colorwayId: string;
  lighting: string;
  background: string;
}): Promise<
  | ActionOk<{ image: { id: string; label: string; imageUrl: string }; costUsd: number }>
  | ActionError
> {
  try {
    await requirePhotoreal("photoreal.generate");

    if (!payload.swatchUrl?.trim()) {
      return { ok: false, error: "Upload a fabric photo first." };
    }

    const colorway = HOUSE_FABRIC_COLORWAYS.find((c) => c.id === payload.colorwayId);
    if (!colorway) {
      return { ok: false, error: "Unknown colourway." };
    }

    const { renderFalEditFromUrl } = await import(
      "@/modules/dress-sizing/providers/fal"
    );

    const prompt = spiralDrapePrompt({
      lighting: payload.lighting,
      background: payload.background,
      colorNote: colorway.prompt,
    });

    const imageUrl = await renderFalEditFromUrl(payload.swatchUrl, prompt);
    if (!imageUrl) {
      return { ok: false, error: `Could not generate ${colorway.label}.` };
    }

    return {
      ok: true,
      image: { id: uuidv7(), label: colorway.label, imageUrl },
      costUsd: 0.04,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Generation failed.";
    return { ok: false, error: message };
  }
}

/** @deprecated Prefer progressive `generateFabricColourwayTileAction` calls from the client. */
export async function generateFabricColourwaySheetAction(payload: {
  swatchUrl: string;
  swatchFile?: File;
  lighting: string;
  background: string;
}): Promise<FabricColourwaySheetResult> {
  try {
    await requirePhotoreal("photoreal.generate");

    if (!payload.swatchUrl && !payload.swatchFile) {
      return { ok: false, error: "Upload a fabric photo first." };
    }

    let swatchUrl = payload.swatchUrl;
    if (!swatchUrl && payload.swatchFile) {
      const { uploadVisionFile } = await import(
        "@/modules/dress-sizing/providers/fal"
      );
      swatchUrl = await uploadVisionFile(payload.swatchFile);
    }

    const images: Array<{ id: string; label: string; imageUrl: string }> = [];
    let costUsd = 0;

    for (const colorway of HOUSE_FABRIC_COLORWAYS) {
      const tile = await generateFabricColourwayTileAction({
        swatchUrl,
        colorwayId: colorway.id,
        lighting: payload.lighting,
        background: payload.background,
      });
      if (!tile.ok) return { ok: false, error: tile.error };
      images.push(tile.image);
      costUsd += tile.costUsd;
    }

    return { ok: true, images, costUsd };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Colourway sheet failed.";
    return { ok: false, error: message };
  }
}

export type StudioChartRow = GarmentChartRow;

export type StudioSizeChartResult =
  | ActionOk<{
      styleId: string;
      styleName: string;
      templateKey: string;
      lengthBand: string;
      fitIntent: string;
      confidence: number | null;
      rows: StudioChartRow[];
      /** House standard for this garment type, before any photo correction. */
      standardRows: StudioChartRow[];
      ghostUrl: string | null;
      silhouette: import("@/modules/dress-sizing/core/silhouette").SilhouetteMode;
      silhouetteLabel: string;
      /** Set when the photo itself was measured; null = style template only. */
      measured: {
        measuredOn: "ghost" | "photo";
        captureContext: string;
        anchor: string;
        corrected: number;
        flagged: number;
        warnings: string[];
        detail: Array<{
          pomKey: string;
          measured: number | null;
          prior: number;
          delta: number;
          flagged: boolean;
        }>;
      } | null;
    }>
  | ActionError;

async function chartRowsForStyle(styleId: string): Promise<StudioChartRow[]> {
  const { eq } = await import("drizzle-orm");
  const { dressGeneratedChart } = await import("@/packages/db/schema");
  const { POM_LABELS } = await import("@/modules/dress-sizing/ui/labels");
  const { STANDARD_SIZES } = await import("@/modules/dress-sizing/db/enums");

  const chart = await db
    .select()
    .from(dressGeneratedChart)
    .where(eq(dressGeneratedChart.styleId, styleId));

  const byPom = new Map<string, Record<string, number>>();
  for (const cell of chart) {
    const bucket = byPom.get(cell.pomKey) ?? {};
    bucket[cell.size] = cell.valueHundredths;
    byPom.set(cell.pomKey, bucket);
  }

  const pomOrder = [
    "chest",
    "waist",
    "hip",
    "shoulder",
    "sleeveLength",
    "garmentLength",
    "hemWidth",
    "neckDrop",
  ] as const;

  return pomOrder
    .filter((key) => byPom.has(key))
    .map((key) => ({
      pomKey: key,
      measurementKey: pomKeyToMeasurementKey(key) ?? key,
      label:
        POM_LABELS[key as keyof typeof POM_LABELS] ??
        key.replace(/([A-Z])/g, " $1"),
      values: STANDARD_SIZES.reduce(
        (acc, size) => {
          const val = byPom.get(key)?.[size];
          if (val != null) acc[size] = val;
          return acc;
        },
        {} as Record<string, number>,
      ),
    }));
}

/** Shape raw chart cells into display rows, same ordering as chartRowsForStyle. */
async function shapeChartRows(
  cells: Array<{ pomKey: string; size: string; valueHundredths: number }>,
): Promise<StudioChartRow[]> {
  const { POM_LABELS } = await import("@/modules/dress-sizing/ui/labels");
  const { STANDARD_SIZES } = await import("@/modules/dress-sizing/db/enums");

  const byPom = new Map<string, Record<string, number>>();
  for (const cell of cells) {
    const bucket = byPom.get(cell.pomKey) ?? {};
    bucket[cell.size] = cell.valueHundredths;
    byPom.set(cell.pomKey, bucket);
  }

  const pomOrder = [
    "chest",
    "waist",
    "hip",
    "shoulder",
    "sleeveLength",
    "garmentLength",
    "hemWidth",
    "neckDrop",
  ] as const;

  return pomOrder
    .filter((key) => byPom.has(key))
    .map((key) => ({
      pomKey: key,
      measurementKey: pomKeyToMeasurementKey(key) ?? key,
      label:
        POM_LABELS[key as keyof typeof POM_LABELS] ??
        key.replace(/([A-Z])/g, " $1"),
      values: STANDARD_SIZES.reduce(
        (acc, size) => {
          const val = byPom.get(key)?.[size];
          if (val != null) acc[size] = val;
          return acc;
        },
        {} as Record<string, number>,
      ),
    }));
}

export async function studioBuildSizeChartAction(
  formData: FormData,
): Promise<StudioSizeChartResult> {
  try {
    await requirePhotoreal("photoreal.generate");

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a garment photo." };
    }

    const { ensureDressSizingSeeded } = await import(
      "@/modules/dress-sizing/db/ensure"
    );
    const { buildStyleChart } = await import(
      "@/modules/dress-sizing/recognition/review"
    );
    const { recognitionConfigured } = await import(
      "@/modules/dress-sizing/recognition/pipeline"
    );
    const { GARMENT_LABELS, FIT_LABELS, LENGTH_LABELS } = await import(
      "@/modules/dress-sizing/ui/labels"
    );
    const { eq } = await import("drizzle-orm");
    const { dressStyle } = await import("@/packages/db/schema");

    await ensureDressSizingSeeded(db);

    let templateKey: import("@/modules/dress-sizing/db/enums").GarmentType =
      "kurti";
    let lengthBand: import("@/modules/dress-sizing/db/enums").LengthBand =
      "knee";
    let fitIntent: import("@/modules/dress-sizing/db/enums").FitIntent =
      "semi_fitted";
    let confidence: number | null = null;
    let imageUrl: string | null = null;
    let stylePoints:
      | import("@/modules/dress-sizing/core/style-points").StylePoints
      | undefined;
    let styleId: string;
    let ghostUrl: string | null = null;
    let standardCells: Array<{
      pomKey: string;
      size: string;
      valueHundredths: number;
    }> = [];
    let measured: {
      measuredOn: "ghost" | "photo";
      captureContext: string;
      anchor: string;
      corrected: number;
      flagged: number;
      warnings: string[];
      detail: Array<{
        pomKey: string;
        measured: number | null;
        prior: number;
        delta: number;
        flagged: boolean;
      }>;
    } | null = null;

    if (recognitionConfigured()) {
      // Shared garment-sizing engine: upload → classify → compose → measure the
      // photo → correct the chart → ghost. Same engine the Designs sizing tab
      // uses, so both surfaces produce identical numbers.
      const { measureGarmentFromPhoto } = await import(
        "@/modules/dress-sizing/service/measure-garment"
      );
      const sizing = await measureGarmentFromPhoto({ image: file });
      templateKey = sizing.templateKey;
      lengthBand = sizing.lengthBand;
      fitIntent = sizing.fitIntent;
      confidence = sizing.confidence;
      stylePoints = sizing.points;
      imageUrl = sizing.imageUrl;
      styleId = sizing.styleId;
      ghostUrl = sizing.ghostUrl;
      standardCells = sizing.standardChart;
      const m = sizing.measurement;
      measured = m
        ? {
            measuredOn: m.measuredOn,
            captureContext: m.landmarks.captureContext,
            anchor: m.anchor,
            corrected: m.applied.length,
            flagged: m.conflicts.length,
            warnings: m.warnings,
            detail: m.detail.map((d) => ({
              pomKey: d.pomKey,
              measured: d.measured,
              prior: d.prior,
              delta: d.delta,
              flagged: d.flagged,
            })),
          }
        : null;
    } else {
      // No vision provider configured — template-only, exactly as before.
      const built = await buildStyleChart(db, {
        templateKey,
        lengthBand,
        fitIntent,
        name: "Studio garment",
        imageUrl,
        confidence,
        status: "draft",
        points: stylePoints,
      });
      styleId = built.styleId;
    }

    const [style] = await db
      .select()
      .from(dressStyle)
      .where(eq(dressStyle.id, styleId))
      .limit(1);

    const styleName = [
      GARMENT_LABELS[templateKey],
      LENGTH_LABELS[lengthBand],
      FIT_LABELS[fitIntent],
    ]
      .filter(Boolean)
      .join(" · ");

    const { resolveSilhouette, SILHOUETTE_LABELS } = await import(
      "@/modules/dress-sizing/core/silhouette"
    );
    const silhouette = resolveSilhouette({
      templateKey,
      fitIntent,
      points: stylePoints,
    });

    return {
      ok: true,
      styleId,
      styleName: style?.name ?? styleName,
      templateKey,
      lengthBand,
      fitIntent,
      confidence,
      rows: await chartRowsForStyle(styleId),
      standardRows: standardCells.length
        ? await shapeChartRows(standardCells)
        : await chartRowsForStyle(styleId),
      ghostUrl,
      silhouette,
      silhouetteLabel: SILHOUETTE_LABELS[silhouette],
      measured,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not build size chart.";
    return { ok: false, error: message };
  }
}

export async function studioOverrideStyleAction(payload: {
  styleId: string;
  templateKey: import("@/modules/dress-sizing/db/enums").GarmentType;
  lengthBand: import("@/modules/dress-sizing/db/enums").LengthBand;
  fitIntent: import("@/modules/dress-sizing/db/enums").FitIntent;
}): Promise<StudioSizeChartResult> {
  try {
    await requirePhotoreal("photoreal.generate");

    const { rebuildStyleChart } = await import(
      "@/modules/dress-sizing/recognition/review"
    );
    const { GARMENT_LABELS, FIT_LABELS, LENGTH_LABELS } = await import(
      "@/modules/dress-sizing/ui/labels"
    );

    await rebuildStyleChart(db, payload.styleId, {
      templateKey: payload.templateKey,
      lengthBand: payload.lengthBand,
      fitIntent: payload.fitIntent,
    });

    const styleName = [
      GARMENT_LABELS[payload.templateKey],
      LENGTH_LABELS[payload.lengthBand],
      FIT_LABELS[payload.fitIntent],
    ]
      .filter(Boolean)
      .join(" · ");

    const { resolveSilhouette, SILHOUETTE_LABELS } = await import(
      "@/modules/dress-sizing/core/silhouette"
    );
    const silhouette = resolveSilhouette({
      templateKey: payload.templateKey,
      fitIntent: payload.fitIntent,
    });

    return {
      ok: true,
      styleId: payload.styleId,
      styleName,
      templateKey: payload.templateKey,
      lengthBand: payload.lengthBand,
      fitIntent: payload.fitIntent,
      confidence: null,
      rows: await chartRowsForStyle(payload.styleId),
      standardRows: await chartRowsForStyle(payload.styleId),
      ghostUrl: null,
      silhouette,
      silhouetteLabel: SILHOUETTE_LABELS[silhouette],
      measured: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not change style.";
    return { ok: false, error: message };
  }
}
