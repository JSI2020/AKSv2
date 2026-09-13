"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  generatePhotorealAction,
  getPhotorealSettingsAction,
  refinePhotorealAction,
  uploadPhotorealFilesAction,
} from "../../actions";
import { usdToPkrAtRate } from "../../currency";
import { FAL_MODEL_OPTIONS } from "../../fal-config";
import {
  HOUSE_MODELS,
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "../../model-persona";
import { POSE_PRESETS } from "../../prompt-builder";
import type { StudioVersion } from "../result-screen";

import { PoseSelect, StudioActions } from "./studio-render-fields";
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

type UploadedAsset = {
  localPreview: string;
  url: string;
  name: string;
};

type DraftMeta = {
  note: string;
  photoUrl: string;
  houseModelId: string;
  houseModelName: string;
  poseId: string;
};

async function uploadPhoto(files: File[]): Promise<UploadedAsset[]> {
  const form = new FormData();
  form.set("kind", "old-design");
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

export function PoseTab({
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
  const inputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<UploadedAsset[]>([]);
  const [note, setNote] = useState("");
  const [houseModelId, setHouseModelId] =
    useState<HouseModelSelection>(defaultHouseModelId);
  const [poseId, setPoseId] = useState("");
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
  const [draft, setDraft] = useState<DraftMeta | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setHouseModelId(defaultHouseModelId);
  }, [defaultHouseModelId]);

  const canGenerate = photos.length > 0;
  const active =
    versions.find((v) => v.id === activeVersionId) ?? versions.at(-1);

  const addPhotos = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadPhoto(list.slice(0, 1));
      setPhotos((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.localPreview));
        return uploaded;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleGenerate = async () => {
    if (!photos[0]) return;
    setBusy(true);
    setBusyLabel("Restaging pose…");
    setError(null);
    setSourcePreview(photos[0].localPreview);
    try {
      const settings = await getPhotorealSettingsAction();
      if (settings.ok) {
        setModelName(
          FAL_MODEL_OPTIONS[settings.fal.generateModel]?.label ?? "fal model",
        );
      }

      const data = await generatePhotorealAction({
        sourceMode: "repose",
        oldDesignUrls: [photos[0].url],
        oldDesignUrl: photos[0].url,
        description: note,
        houseModelId,
        poseId: poseId || null,
      });

      if (!data.ok || !data.version) {
        throw new Error(!data.ok ? data.error : "Generation failed.");
      }

      const callCost = data.costUsd ?? data.version.costUsd ?? data.totalCost;
      onSessionCost(callCost);

      setDraft({
        note,
        photoUrl: photos[0].url,
        houseModelId: data.houseModel?.id ?? "ayesha",
        houseModelName: data.houseModel?.name ?? "Ayesha",
        poseId: data.pose?.id ?? poseId,
      });
      setRefinePoseId(data.pose?.id ?? poseId);
      setVersions([data.version]);
      setActiveVersionId(data.version.id);
      setTotalCost(data.totalCost);
      toast("Pose restaged");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRefine = async () => {
    if (!active || !draft || (!feedback.trim() && !refinePoseId)) return;
    setBusy(true);
    setBusyLabel("Refining pose…");
    setError(null);
    try {
      const data = await refinePhotorealAction({
        baseImageUrl: active.imageUrl,
        oldDesignUrl: draft.photoUrl,
        parentVersionId: active.id,
        description: draft.note,
        feedback,
        previousTotalCost: totalCost,
        houseModelId: draft.houseModelId,
        promptMode: "repose",
        poseId: refinePoseId || null,
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
      toast("Pose refined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refine failed.");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.localPreview));
    setPhotos([]);
    setNote("");
    setPoseId("");
    setRefinePoseId("");
    setVersions([]);
    setActiveVersionId("");
    setDraft(null);
    setTotalCost(0);
    setSourcePreview(null);
    setError(null);
    setFeedback("");
    toast("Cleared");
  };

  return (
    <Workbench
      input={
        <div className="max-w-xl">
          <PanelHead label="Input" step="01" />

          <StudioSection title="Garment photo" first>
            <p className="mb-4 text-[12.5px] leading-relaxed text-chalk">
              <span className="text-greige">Required:</span> one catalogue
              photo. The dress stays locked — only pose and house model change.
            </p>
            <StudioDropzone
              label="Drop garment photo here"
              sublabel="PNG, JPG, WEBP — one photo"
              disabled={busy || uploading}
              dragOver={dragOver}
              onDragEnter={() => setDragOver(true)}
              onDragLeave={() => setDragOver(false)}
              onDrop={(files) => void addPhotos(files)}
              onChoose={() => inputRef.current?.click()}
              inputRef={inputRef}
              onFileChange={(files) => void addPhotos(files)}
              multiple={false}
            />
            <ThumbRow
              assets={photos.map(({ localPreview, name }) => ({
                localPreview,
                name,
              }))}
              onRemove={(i) => {
                const p = photos[i];
                if (p) URL.revokeObjectURL(p.localPreview);
                setPhotos((prev) => prev.filter((_, idx) => idx !== i));
              }}
            />
          </StudioSection>

          <StudioSection title="Pose & model">
            <div className="space-y-5">
              <div>
                <label className={studioLabelClass} htmlFor="repose-model">
                  Catalogue model
                </label>
                <select
                  id="repose-model"
                  className={studioFieldClass}
                  value={houseModelId}
                  disabled={busy}
                  onChange={(e) =>
                    setHouseModelId(e.target.value as HouseModelSelection)
                  }
                >
                  <option value={RANDOM_HOUSE_MODEL_ID}>
                    Random each render (recommended)
                  </option>
                  {HOUSE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.cue}
                    </option>
                  ))}
                </select>
                <p className={studioHintClass}>
                  Replaces the person in the photo. Dress stays the same.
                </p>
              </div>

              <PoseSelect
                id="repose-pose"
                value={poseId}
                onChange={setPoseId}
                disabled={busy}
                hint="Commercial pose library — dress details stay locked."
              />

              <div>
                <label className={studioLabelClass} htmlFor="repose-note">
                  Pose / camera note
                </label>
                <textarea
                  id="repose-note"
                  className={cn(
                    studioFieldClass,
                    "min-h-[72px] resize-y leading-relaxed",
                  )}
                  placeholder='Optional — e.g. "three-quarter walk toward camera, soft courtyard light"'
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busy}
                />
                <p className={studioHintClass}>
                  Do not ask to recolour or redesign the garment here.
                </p>
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
              {uploading ? "Uploading…" : busy ? busyLabel : "Change pose"}
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
              title="Restaged pose appears here"
              subtitle="Upload a garment photo, pick model and pose, then Change pose."
            />
          ) : (
            <div className="space-y-5">
              <div className="relative overflow-hidden border border-indigo-lift rounded-[2px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.imageUrl}
                  alt="Restaged pose"
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

              {sourcePreview && (
                <div className="overflow-hidden border border-indigo-lift rounded-[2px]">
                  <p className="border-b border-indigo-lift px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-chalk">
                    Source dress
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourcePreview}
                    alt="Source garment"
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

              <StudioSection title="Refine pose" first>
                <div className="space-y-4">
                  <div>
                    <label
                      className={studioLabelClass}
                      htmlFor="repose-refine-feedback"
                    >
                      Notes
                    </label>
                    <textarea
                      id="repose-refine-feedback"
                      className={cn(studioFieldClass, "min-h-[72px] resize-y")}
                      placeholder='e.g. "walk toward camera, three-quarter turn"'
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      disabled={busy}
                    />
                  </div>

                  <PoseSelect
                    id="repose-refine-pose"
                    value={refinePoseId}
                    onChange={setRefinePoseId}
                    disabled={busy}
                    hint="Or pick a pose chip — then Refine."
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
