"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  generatePhotorealAction,
  getPhotorealSettingsAction,
  refinePhotorealAction,
  savePhotorealDesignAction,
  uploadPhotorealFilesAction,
} from "../../actions";
import { usdToPkrAtRate } from "../../currency";
import { FAL_MODEL_OPTIONS } from "../../fal-config";
import {
  HOUSE_MODELS,
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "../../model-persona";
import { POSE_PRESETS, type PromptMode } from "../../prompt-builder";
import type { StudioVersion } from "../result-screen";

import {
  BackgroundSelect,
  PoseSelect,
  SourceModePicker,
  StudioActions,
} from "./studio-render-fields";
import {
  EmptyOutput,
  PanelHead,
  StudioDropzone,
  StudioSection,
  ThumbRow,
  Workbench,
  studioFieldClass,
  studioHintClass,
  studioLabelClass,
  useStudioToast,
} from "./studio-primitives";

const DEFAULT_BACKGROUND_PRESET = "courtyard";

type UploadedAsset = {
  localPreview: string;
  url: string;
  name: string;
};

type DraftMeta = {
  description: string;
  shirtColour: string;
  trouserColour: string;
  fabric: string;
  sketchUrls: string[];
  oldDesignUrl?: string;
  houseModelId: string;
  houseModelName: string;
  promptMode: PromptMode;
  poseId: string;
  backgroundPreset: string;
  backgroundCustom: string;
};

async function uploadFiles(
  files: File[],
  kind: "sketch" | "old-design",
): Promise<UploadedAsset[]> {
  const form = new FormData();
  form.set("kind", kind);
  for (const file of files) form.append("files", file);

  const result = await uploadPhotorealFilesAction(form);
  if (!result.ok || !result.files?.length) {
    throw new Error(!result.ok ? result.error : "Upload failed.");
  }

  return result.files.map((f, i) => ({
    localPreview: URL.createObjectURL(files[i]!),
    url: f.url,
    name: f.originalName,
  }));
}

export function RenderTab({
  defaultHouseModelId,
  sessionCostPkr,
  usdPkrRate,
  onSessionCost,
}: {
  defaultHouseModelId: HouseModelSelection;
  sessionCostPkr?: number;
  usdPkrRate: number;
  onSessionCost: (deltaUsd: number) => void;
}) {
  const toast = useStudioToast();
  const sketchInputRef = useRef<HTMLInputElement>(null);
  const oldInputRef = useRef<HTMLInputElement>(null);
  const fabricInputRef = useRef<HTMLInputElement>(null);

  const [sourceMode, setSourceMode] = useState<PromptMode>("sketch");
  const [sketches, setSketches] = useState<UploadedAsset[]>([]);
  const [oldDesigns, setOldDesigns] = useState<UploadedAsset[]>([]);
  const [fabricSwatch, setFabricSwatch] = useState<UploadedAsset | null>(null);
  const [description, setDescription] = useState("");
  const [shirtColour, setShirtColour] = useState("");
  const [trouserColour, setTrouserColour] = useState("");
  const [fabric, setFabric] = useState("");
  const [houseModelId, setHouseModelId] =
    useState<HouseModelSelection>(defaultHouseModelId);
  const [poseId, setPoseId] = useState("");
  const [backgroundPreset, setBackgroundPreset] = useState(
    DEFAULT_BACKGROUND_PRESET,
  );
  const [backgroundCustom, setBackgroundCustom] = useState("");
  const [refinePoseId, setRefinePoseId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Generating…");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [modelName, setModelName] = useState<string>();

  const [versions, setVersions] = useState<StudioVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftMeta | null>(null);
  const [sketchPreviews, setSketchPreviews] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setHouseModelId(defaultHouseModelId);
  }, [defaultHouseModelId]);

  const canGenerate =
    sourceMode === "sketch"
      ? sketches.length > 0
      : sourceMode === "old-design"
        ? oldDesigns.length > 0
        : Boolean(description.trim());

  const active =
    versions.find((v) => v.id === activeVersionId) ?? versions.at(-1);

  const addSketches = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(list, "sketch");
      setSketches((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  const addOldDesigns = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(list, "old-design");
      setOldDesigns((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleGenerate = async () => {
    setBusy(true);
    setBusyLabel("Generating…");
    setError(null);
    const oldUrls =
      sourceMode === "old-design" ? oldDesigns.map((s) => s.url) : [];
    setSketchPreviews(
      sourceMode === "sketch"
        ? sketches.map((s) => s.localPreview)
        : sourceMode === "old-design"
          ? oldDesigns.map((s) => s.localPreview)
          : [],
    );
    setSavedDesignId(null);
    try {
      const settings = await getPhotorealSettingsAction();
      if (settings.ok) {
        setModelName(
          FAL_MODEL_OPTIONS[settings.fal.generateModel]?.label ?? "fal model",
        );
      }

      const data = await generatePhotorealAction({
        sourceMode,
        sketchUrls: sourceMode === "sketch" ? sketches.map((s) => s.url) : [],
        oldDesignUrls: oldUrls,
        oldDesignUrl: oldUrls[0],
        description,
        shirtColour,
        trouserColour,
        fabric: fabric || fabricSwatch?.name || "",
        houseModelId,
        poseId: poseId || null,
        backgroundPreset,
        backgroundCustom: backgroundCustom || null,
      });

      if (!data.ok || !data.version) {
        throw new Error(!data.ok ? data.error : "Generation failed.");
      }

      const callCost = data.costUsd ?? data.version.costUsd ?? data.totalCost;
      onSessionCost(callCost);

      setDraft({
        description,
        shirtColour,
        trouserColour,
        fabric: fabric || fabricSwatch?.name || "",
        sketchUrls:
          sourceMode === "sketch" ? sketches.map((s) => s.url) : [],
        oldDesignUrl: oldUrls[0],
        houseModelId: data.houseModel?.id ?? "ayesha",
        houseModelName: data.houseModel?.name ?? "Ayesha",
        promptMode: data.promptMode ?? sourceMode,
        poseId: data.pose?.id ?? poseId,
        backgroundPreset,
        backgroundCustom,
      });
      setRefinePoseId(data.pose?.id ?? poseId);
      setVersions([data.version]);
      setActiveVersionId(data.version.id);
      setTotalCost(data.totalCost);
      toast("Render complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRefine = async () => {
    if (!active || !draft || (!feedback.trim() && !refinePoseId)) return;
    setBusy(true);
    setBusyLabel("Refining…");
    setError(null);
    try {
      const data = await refinePhotorealAction({
        baseImageUrl: active.imageUrl,
        sketchUrls: draft.sketchUrls,
        oldDesignUrl: draft.oldDesignUrl,
        parentVersionId: active.id,
        description: draft.description,
        shirtColour: draft.shirtColour,
        trouserColour: draft.trouserColour,
        fabric: draft.fabric,
        feedback,
        previousTotalCost: totalCost,
        houseModelId: draft.houseModelId,
        promptMode: draft.promptMode,
        poseId: refinePoseId || null,
        backgroundPreset: draft.backgroundPreset,
        backgroundCustom: draft.backgroundCustom,
      });

      if (!data.ok || !data.version) {
        throw new Error(!data.ok ? data.error : "Refine failed.");
      }

      const callCost = data.costUsd ?? data.version.costUsd ?? 0;
      onSessionCost(callCost);
      setVersions((prev) => [...prev, data.version]);
      setActiveVersionId(data.version.id);
      setTotalCost(data.totalCost);
      setFeedback("");
      toast("Refinement complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refine failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!draft || !versions.length) return;
    const data = await savePhotorealDesignAction({
      designId: savedDesignId ?? undefined,
      description: draft.description,
      shirtColour: draft.shirtColour,
      trouserColour: draft.trouserColour,
      fabric: draft.fabric,
      sketchUrls: draft.sketchUrls,
      oldDesignUrl: draft.oldDesignUrl,
      houseModelId: draft.houseModelId,
      houseModelName: draft.houseModelName,
      versions: versions.map((v) => ({
        id: v.id,
        parentVersionId: v.parentVersionId,
        imageUrl: v.imageUrl,
        prompt: v.prompt || "",
        negativePrompt: v.negativePrompt,
        seed: v.seed,
        modelId: v.modelId,
        feedback: v.feedback,
        costUsd: v.costUsd,
        requestId: v.requestId,
      })),
    });
    if (!data.ok) throw new Error(data.error || "Save failed.");
    if (data.designId) setSavedDesignId(data.designId);
    toast("Saved to gallery");
  };

  const clearAll = () => {
    sketches.forEach((s) => URL.revokeObjectURL(s.localPreview));
    oldDesigns.forEach((s) => URL.revokeObjectURL(s.localPreview));
    if (fabricSwatch) URL.revokeObjectURL(fabricSwatch.localPreview);
    setSketches([]);
    setOldDesigns([]);
    setFabricSwatch(null);
    setDescription("");
    setShirtColour("");
    setTrouserColour("");
    setFabric("");
    setPoseId("");
    setBackgroundPreset(DEFAULT_BACKGROUND_PRESET);
    setBackgroundCustom("");
    setRefinePoseId("");
    setVersions([]);
    setActiveVersionId("");
    setDraft(null);
    setTotalCost(0);
    setSavedDesignId(null);
    setError(null);
    setFeedback("");
    toast("Cleared");
  };

  const reqLine =
    sourceMode === "sketch"
      ? "one or more sketches"
      : sourceMode === "old-design"
        ? "one or more design photos"
        : "a written description below";

  return (
    <Workbench
      input={
        <div className="max-w-xl">
          <PanelHead label="Input" step="01" />

          <StudioSection title="Starting point" first>
            <SourceModePicker
              value={sourceMode}
              onChange={(mode) => {
                setSourceMode(mode);
                setError(null);
              }}
              disabled={busy}
            />
          </StudioSection>

          {sourceMode !== "description" && (
            <StudioSection title="Upload">
              <p className="mb-4 text-[12.5px] leading-relaxed text-chalk">
                <span className="text-greige">Required:</span> {reqLine}.
                Colours and fabric are optional.
              </p>
              <StudioDropzone
                label={
                  sourceMode === "sketch"
                    ? "Drop sketches here"
                    : "Drop design photos here"
                }
                sublabel="PNG, JPG, WEBP — multiple OK"
                disabled={busy || uploading}
                dragOver={dragOver}
                onDragEnter={() => setDragOver(true)}
                onDragLeave={() => setDragOver(false)}
                onDrop={(files) =>
                  void (sourceMode === "sketch"
                    ? addSketches(files)
                    : addOldDesigns(files))
                }
                onChoose={() =>
                  (sourceMode === "sketch"
                    ? sketchInputRef
                    : oldInputRef
                  ).current?.click()
                }
                inputRef={sourceMode === "sketch" ? sketchInputRef : oldInputRef}
                onFileChange={(files) =>
                  void (sourceMode === "sketch"
                    ? addSketches(files)
                    : addOldDesigns(files))
                }
                multiple
              />
              <ThumbRow
                assets={
                  sourceMode === "sketch"
                    ? sketches.map(({ localPreview, name }) => ({
                        localPreview,
                        name,
                      }))
                    : oldDesigns.map(({ localPreview, name }) => ({
                        localPreview,
                        name,
                      }))
                }
                onRemove={(i) => {
                  if (sourceMode === "sketch") {
                    const s = sketches[i];
                    if (s) URL.revokeObjectURL(s.localPreview);
                    setSketches((prev) => prev.filter((_, idx) => idx !== i));
                  } else {
                    const s = oldDesigns[i];
                    if (s) URL.revokeObjectURL(s.localPreview);
                    setOldDesigns((prev) => prev.filter((_, idx) => idx !== i));
                  }
                }}
              />
            </StudioSection>
          )}

          {sourceMode === "description" && (
            <StudioSection title="Brief">
              <p className="text-[12.5px] leading-relaxed text-chalk">
                <span className="text-greige">Required:</span> a written
                description in Garment notes below. No upload in this mode.
              </p>
            </StudioSection>
          )}

          <StudioSection title="Shot setup">
            <div className="space-y-5">
              <div>
                <label className={studioLabelClass} htmlFor="catalogue-model">
                  Catalogue model
                </label>
                <select
                  id="catalogue-model"
                  className={studioFieldClass}
                  value={houseModelId}
                  disabled={busy}
                  onChange={(e) =>
                    setHouseModelId(e.target.value as HouseModelSelection)
                  }
                >
                  <option value={RANDOM_HOUSE_MODEL_ID}>
                    Random each design (recommended)
                  </option>
                  {HOUSE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.cue}
                    </option>
                  ))}
                </select>
                <p className={studioHintClass}>
                  Same model stays locked while you refine one design.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <PoseSelect
                  value={poseId}
                  onChange={setPoseId}
                  disabled={busy}
                  hint="Full commercial pose library — grouped by stance."
                />
                <BackgroundSelect
                  presetId={backgroundPreset}
                  custom={backgroundCustom}
                  onPresetChange={setBackgroundPreset}
                  onCustomChange={setBackgroundCustom}
                  disabled={busy}
                />
              </div>
            </div>
          </StudioSection>

          <StudioSection title="Garment notes">
            <div className="space-y-5">
              <div>
                <label className={studioLabelClass} htmlFor="render-desc">
                  Description
                </label>
                <textarea
                  id="render-desc"
                  className={cn(studioFieldClass, "min-h-[88px] resize-y leading-relaxed")}
                  placeholder='Optional — e.g. "floor-length straight kameez, tonal white-on-white cutwork border, soft north-light"'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={studioLabelClass} htmlFor="shirt-colour">
                    Shirt colour
                  </label>
                  <input
                    id="shirt-colour"
                    className={studioFieldClass}
                    placeholder="optional"
                    value={shirtColour}
                    onChange={(e) => setShirtColour(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className={studioLabelClass} htmlFor="trouser-colour">
                    Trouser colour
                  </label>
                  <input
                    id="trouser-colour"
                    className={studioFieldClass}
                    placeholder="optional"
                    value={trouserColour}
                    onChange={(e) => setTrouserColour(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>

              <div>
                <span className={studioLabelClass}>Fabric swatch</span>
                <StudioDropzone
                  label="Attach fabric"
                  sublabel="optional · applies to render"
                  slim
                  disabled={busy}
                  onChoose={() => fabricInputRef.current?.click()}
                  inputRef={fabricInputRef}
                  onFileChange={(files) => {
                    const file = files[0];
                    if (!file) return;
                    setFabricSwatch({
                      localPreview: URL.createObjectURL(file),
                      url: "",
                      name: file.name,
                    });
                    setFabric(file.name.replace(/\.[^.]+$/, ""));
                  }}
                />
                {fabricSwatch && (
                  <ThumbRow
                    assets={[
                      {
                        localPreview: fabricSwatch.localPreview,
                        name: fabricSwatch.name,
                      },
                    ]}
                    onRemove={() => {
                      URL.revokeObjectURL(fabricSwatch.localPreview);
                      setFabricSwatch(null);
                    }}
                  />
                )}
              </div>
            </div>
          </StudioSection>

          {error && (
            <p className="mt-4 text-[13px] text-madder" role="alert">
              {error}
            </p>
          )}

          <StudioActions
            meta={
              sessionCostPkr != null && sessionCostPkr > 0 ? (
                <>
                  Session PKR {sessionCostPkr.toLocaleString("en-PK")} · rate Rs{" "}
                  {usdPkrRate}/USD
                </>
              ) : undefined
            }
          >
            <Button
              type="button"
              disabled={!canGenerate || busy || uploading}
              className="min-w-[9rem] rounded-[2px] border border-zari bg-zari px-5 py-2 text-[13px] font-semibold text-indigo hover:bg-zari/90"
              onClick={() => void handleGenerate()}
            >
              {uploading ? "Uploading…" : busy ? busyLabel : "Generate"}
            </Button>
            <button
              type="button"
              className="text-[12.5px] text-chalk underline-offset-2 hover:text-greige hover:underline"
              disabled={busy}
              onClick={clearAll}
            >
              Clear
            </button>
          </StudioActions>
        </div>
      }
      output={
        <div>
          <PanelHead label="Result" step="02" />
          {!active ? (
            <EmptyOutput
              title="Your render appears here"
              subtitle="Add a sketch and press Generate. Refinements keep the same model until you clear."
            />
          ) : (
            <div className="space-y-5">
              <div className="relative overflow-hidden border border-indigo-lift rounded-[2px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.imageUrl}
                  alt="Generated render"
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="absolute inset-inline-start-0 inset-block-end-0 border-t border-indigo-lift/80 bg-indigo/90 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-chalk">
                  {draft?.houseModelName ?? "model"}
                </span>
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-indigo/85">
                    <p className="text-[13px] text-greige">
                      {busyLabel}
                      {modelName ? ` · ${modelName}` : ""}
                    </p>
                  </div>
                )}
              </div>

              {versions.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {versions.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setActiveVersionId(v.id)}
                      className={cn(
                        "shrink-0 overflow-hidden border rounded-[2px]",
                        v.id === active.id
                          ? "border-zari"
                          : "border-indigo-lift opacity-75 hover:opacity-100",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.imageUrl}
                        alt={`Version ${i + 1}`}
                        className="size-14 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {sketchPreviews[0] && (
                <div className="overflow-hidden border border-indigo-lift rounded-[2px]">
                  <p className="border-b border-indigo-lift px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-chalk">
                    Source
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sketchPreviews[0]}
                    alt="Source"
                    className="max-h-28 w-full bg-indigo/30 object-contain"
                  />
                </div>
              )}

              <p className="text-[11px] text-chalk">
                this design: PKR{" "}
                {usdToPkrAtRate(totalCost, usdPkrRate).toLocaleString("en-PK")}{" "}
                · {versions.length} version
                {versions.length === 1 ? "" : "s"}
              </p>

              <StudioSection title="Refine" first>
                <div className="space-y-4">
                  <div>
                    <label className={studioLabelClass} htmlFor="refine-feedback">
                      Notes
                    </label>
                    <textarea
                      id="refine-feedback"
                      className={cn(studioFieldClass, "min-h-[72px] resize-y")}
                      placeholder='e.g. "make the shirt deep red, warmer lighting"'
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      disabled={busy}
                    />
                  </div>

                  <PoseSelect
                    id="refine-pose"
                    value={refinePoseId}
                    onChange={setRefinePoseId}
                    disabled={busy}
                    hint="Or pick a pose below — then Refine."
                  />

                  <div>
                    <p className={studioLabelClass}>Quick pose</p>
                    <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                      {POSE_PRESETS.map((pose) => (
                        <button
                          key={pose.id}
                          type="button"
                          disabled={busy}
                          className={cn(
                            "border border-indigo-lift px-2 py-0.5 text-[10.5px] text-chalk rounded-[2px] transition hover:border-zari hover:text-greige",
                            refinePoseId === pose.id &&
                              "border-zari text-greige",
                          )}
                          onClick={() => {
                            setRefinePoseId(pose.id);
                            setFeedback(pose.feedback);
                          }}
                        >
                          {pose.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-indigo-lift pt-4">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy || (!feedback.trim() && !refinePoseId)}
                      className="rounded-[2px] border-zari text-[12px] text-zari hover:bg-indigo-lift"
                      onClick={() => void handleRefine()}
                    >
                      Refine
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      className="rounded-[2px] border-indigo-lift text-[12px] text-greige"
                      onClick={() =>
                        void handleSave().catch((e) => setError(String(e)))
                      }
                    >
                      <Save className="size-3.5" />
                      Save
                    </Button>
                    <a
                      href={active.imageUrl}
                      download
                      className="inline-flex items-center gap-1 border border-indigo-lift px-2.5 py-1.5 text-[12px] text-greige rounded-[2px] hover:border-zari hover:text-zari"
                    >
                      <Download className="size-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              </StudioSection>
            </div>
          )}
        </div>
      }
    />
  );
}
