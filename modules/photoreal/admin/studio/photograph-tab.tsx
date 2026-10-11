"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Loader2,
  MapPin,
  Move,
  PenLine,
  Star,
  X,
  ZoomIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  groupedStudioBackgrounds,
  STUDIO_BACKGROUND_GROUPS,
  STUDIO_BACKGROUND_PRESETS,
  type StudioBackgroundGroup,
} from "@/modules/designs/studio-backgrounds";

import {
  generatePhotorealAction,
  refinePhotorealAction,
  uploadPhotorealFilesAction,
} from "../../actions";
import {
  HOUSE_MODELS,
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "../../model-persona";
import {
  addPhotosToProductAction,
  listStudioDesignOptionsAction,
  type ProductPhotoSlot,
  type StudioDesignOption,
} from "../../product-actions";
import { MAX_GARMENT_REFERENCES } from "../../prompt-builder";
import {
  CLOSER_POSES,
  poseForShot,
  SHOTS,
  STANDARD_SET,
  VARIATION_POSES,
  type ShotId,
} from "../../shot-list";

import { downloadImage } from "./download-image";
import { StudioActions } from "./studio-render-fields";
import {
  PanelHead,
  StudioDropzone,
  StudioSection,
  ThumbRow,
  Workbench,
  studioFieldClass,
  studioHintClass,
  studioLabelClass,
  studioPrimaryButtonClass,
  useStudioToast,
} from "./studio-primitives";

type SourceKind = "mannequin" | "person";

type UploadedAsset = { localPreview: string; url: string; name: string };

/** One photo on the contact sheet. */
type Frame = {
  id: string;
  imageUrl: string;
  label: string;
  poseId: string | null;
  backgroundPreset: string;
  houseModelId: string;
  houseModelName: string;
  costUsd: number;
  /** Original garment photos this frame must stay true to. */
  sourceUrls: string[];
  sourceKind: SourceKind;
  shotId?: ShotId;
  favourite: boolean;
};

type Pending = { id: string; label: string };

type CardPanel = { frameId: string; kind: "location" | "fix" } | null;

async function uploadDressPhotos(files: File[]): Promise<UploadedAsset[]> {
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

const DEFAULT_LOCATION = "studio";

function presetLabel(id: string): string {
  return STUDIO_BACKGROUND_PRESETS.find((p) => p.id === id)?.label ?? "Custom";
}

function pickOther<T extends string>(pool: readonly T[], current: string | null): T {
  const options = pool.filter((p) => p !== current);
  return options[Math.floor(Math.random() * options.length)] ?? pool[0]!;
}

export function PhotographTab({
  defaultHouseModelId,
  perImagePkr,
  usdPkrRate,
  onSessionCost,
}: {
  defaultHouseModelId: HouseModelSelection;
  /** Estimated cost of one photo at the current quality, in PKR. */
  perImagePkr: number;
  usdPkrRate: number;
  onSessionCost: (deltaUsd: number) => void;
}) {
  const toast = useStudioToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Brief
  const [photos, setPhotos] = useState<UploadedAsset[]>([]);
  const [sourceKind, setSourceKind] = useState<SourceKind>("mannequin");
  const [houseModelId, setHouseModelId] =
    useState<HouseModelSelection>(defaultHouseModelId);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [locationGroup, setLocationGroup] =
    useState<StudioBackgroundGroup>("Studio");
  const [customLocation, setCustomLocation] = useState("");
  const [shots, setShots] = useState<ShotId[]>(["front"]);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [allModels, setAllModels] = useState(false);

  // Results
  const [frames, setFrames] = useState<Frame[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busyFrames, setBusyFrames] = useState<Set<string>>(new Set());
  const [lockedModel, setLockedModel] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [panel, setPanel] = useState<CardPanel>(null);
  const [fixNote, setFixNote] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [productOpen, setProductOpen] = useState(false);

  // UI
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHouseModelId(defaultHouseModelId);
  }, [defaultHouseModelId]);

  const shooting = pending.length > 0;
  const totalUsd = frames.reduce((n, f) => n + f.costUsd, 0);
  const favourites = frames.filter((f) => f.favourite);
  const orderedShots = SHOTS.filter((s) => shots.includes(s.id));
  const shootCostPkr = Math.round(orderedShots.length * perImagePkr);

  const addPhotos = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!list.length) return;
      const room = MAX_GARMENT_REFERENCES - photos.length;
      if (room <= 0) {
        setError(`Up to ${MAX_GARMENT_REFERENCES} photos — remove one to add another.`);
        return;
      }
      setUploading(true);
      setError(
        list.length > room
          ? `Only the first ${room} added — up to ${MAX_GARMENT_REFERENCES} photos per dress.`
          : null,
      );
      try {
        const uploaded = await uploadDressPhotos(list.slice(0, room));
        setPhotos((prev) => [...prev, ...uploaded].slice(0, MAX_GARMENT_REFERENCES));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [photos.length],
  );

  const toggleShot = (id: ShotId) =>
    setShots((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  /** Render one shot from the current brief. */
  const renderShot = async (
    poseId: string | null,
    modelId: HouseModelSelection,
    sourceUrls: string[],
  ) => {
    const data = await generatePhotorealAction({
      sourceMode: sourceKind === "mannequin" ? "mannequin" : "repose",
      oldDesignUrls: sourceUrls,
      oldDesignUrl: sourceUrls[0],
      description: note,
      houseModelId: modelId,
      poseId,
      backgroundPreset: location,
      backgroundCustom: customLocation || null,
    });
    if (!data.ok || !data.version) {
      throw new Error(!data.ok ? data.error : "Generation failed.");
    }
    onSessionCost(data.costUsd ?? data.version.costUsd ?? 0);
    return data;
  };

  const handleShoot = async () => {
    if (!photos.length || !orderedShots.length) return;
    setError(null);
    const sourceUrls = photos.map((p) => p.url);
    const batch = orderedShots.map((shot) => ({
      shot,
      pendingId: `${shot.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    setPending((prev) => [
      ...prev,
      ...batch.map(({ shot, pendingId }) => ({ id: pendingId, label: shot.label })),
    ]);

    const toFrame = (
      data: Awaited<ReturnType<typeof renderShot>>,
      label: string,
      shotId: ShotId,
      poseId: string | null,
    ): Frame => ({
      id: data.version.id,
      imageUrl: data.version.imageUrl,
      label,
      poseId: data.pose?.id ?? poseId,
      backgroundPreset: customLocation ? "custom" : location,
      houseModelId: data.houseModel.id,
      houseModelName: data.houseModel.name,
      costUsd: data.costUsd ?? data.version.costUsd ?? 0,
      sourceUrls,
      sourceKind,
      shotId,
      favourite: false,
    });

    // The same woman across the whole shoot: an explicit pick wins; on
    // "Random", the first frame decides and later frames reuse her.
    let modelId: HouseModelSelection =
      houseModelId === RANDOM_HOUSE_MODEL_ID && lockedModel
        ? lockedModel.id
        : houseModelId;

    const settle = (pendingId: string) =>
      setPending((prev) => prev.filter((p) => p.id !== pendingId));

    const [first, ...rest] = batch;
    let failed = 0;
    try {
      const pose = poseForShot(first!.shot, sourceKind);
      const data = await renderShot(pose, modelId, sourceUrls);
      modelId = data.houseModel.id;
      setLockedModel({ id: data.houseModel.id, name: data.houseModel.name });
      setFrames((prev) => [...prev, toFrame(data, first!.shot.label, first!.shot.id, pose)]);
    } catch (err) {
      failed++;
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      settle(first!.pendingId);
    }

    await Promise.allSettled(
      rest.map(async ({ shot, pendingId }) => {
        const pose = poseForShot(shot, sourceKind);
        try {
          const data = await renderShot(pose, modelId, sourceUrls);
          setFrames((prev) => [...prev, toFrame(data, shot.label, shot.id, pose)]);
        } catch {
          failed++;
        } finally {
          settle(pendingId);
        }
      }),
    );

    const done = batch.length - failed;
    if (failed && done) {
      setError(`${failed} of ${batch.length} photos failed — the rest are ready. Try those shots again.`);
    }
    if (done) toast(`${done} photo${done === 1 ? "" : "s"} ready`);
  };

  /** A variation of an existing frame — the garment is re-read from the originals. */
  const varyFrame = async (
    frame: Frame,
    change: { label: string; poseId?: string; backgroundPreset?: string; feedback?: string },
  ) => {
    setBusyFrames((prev) => new Set(prev).add(frame.id));
    setError(null);
    const newBackground = change.backgroundPreset
      ? STUDIO_BACKGROUND_PRESETS.find((p) => p.id === change.backgroundPreset)
      : undefined;
    const feedback = [
      change.feedback?.trim(),
      newBackground ? `Change the background to: ${newBackground.prompt}` : null,
    ]
      .filter(Boolean)
      .join(". ");
    try {
      const data = await refinePhotorealAction({
        baseImageUrl: frame.imageUrl,
        oldDesignUrl: frame.sourceUrls[0],
        oldDesignUrls: frame.sourceUrls,
        parentVersionId: frame.id,
        description: note,
        feedback,
        houseModelId: frame.houseModelId,
        promptMode: frame.sourceKind === "mannequin" ? "mannequin" : "repose",
        poseId: change.poseId ?? null,
        backgroundPreset:
          newBackground?.id ??
          (frame.backgroundPreset === "custom" ? null : frame.backgroundPreset),
        backgroundCustom: null,
      });
      if (!data.ok || !data.version) {
        throw new Error(!data.ok ? data.error : "Variation failed.");
      }
      onSessionCost(data.costUsd ?? data.version.costUsd ?? 0);
      const next: Frame = {
        ...frame,
        id: data.version.id,
        imageUrl: data.version.imageUrl,
        label: change.label,
        poseId: change.poseId ?? frame.poseId,
        backgroundPreset: newBackground?.id ?? frame.backgroundPreset,
        costUsd: data.costUsd ?? data.version.costUsd ?? 0,
        shotId: undefined,
        favourite: false,
      };
      // Show the variation right after the frame it came from.
      setFrames((prev) => {
        const at = prev.findIndex((f) => f.id === frame.id);
        const copy = [...prev];
        copy.splice(at + 1, 0, next);
        return copy;
      });
      toast("Variation ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Variation failed.");
    } finally {
      setBusyFrames((prev) => {
        const copy = new Set(prev);
        copy.delete(frame.id);
        return copy;
      });
    }
  };

  /**
   * "Closer": a fresh close shot from the original dress photos (same model,
   * same location). Editing the full-length frame instead tends to come back
   * full-length, because the garment lock asks for the whole outfit.
   */
  const closerFrame = async (frame: Frame) => {
    setBusyFrames((prev) => new Set(prev).add(frame.id));
    setError(null);
    const poseId = pickOther(CLOSER_POSES, frame.poseId);
    try {
      const data = await generatePhotorealAction({
        sourceMode: frame.sourceKind === "mannequin" ? "mannequin" : "repose",
        oldDesignUrls: frame.sourceUrls,
        oldDesignUrl: frame.sourceUrls[0],
        description: note,
        houseModelId: frame.houseModelId,
        poseId,
        backgroundPreset:
          frame.backgroundPreset === "custom" ? null : frame.backgroundPreset,
        backgroundCustom: frame.backgroundPreset === "custom" ? customLocation || null : null,
      });
      if (!data.ok || !data.version) {
        throw new Error(!data.ok ? data.error : "Close shot failed.");
      }
      onSessionCost(data.costUsd ?? data.version.costUsd ?? 0);
      const next: Frame = {
        ...frame,
        id: data.version.id,
        imageUrl: data.version.imageUrl,
        label: `${frame.label} · closer`,
        poseId,
        costUsd: data.costUsd ?? data.version.costUsd ?? 0,
        shotId: undefined,
        favourite: false,
      };
      setFrames((prev) => {
        const at = prev.findIndex((f) => f.id === frame.id);
        const copy = [...prev];
        copy.splice(at + 1, 0, next);
        return copy;
      });
      toast("Close shot ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close shot failed.");
    } finally {
      setBusyFrames((prev) => {
        const copy = new Set(prev);
        copy.delete(frame.id);
        return copy;
      });
    }
  };

  const clearAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.localPreview));
    setPhotos([]);
    setFrames([]);
    setPending([]);
    setLockedModel(null);
    setNote("");
    setShots(["front"]);
    setError(null);
    setPanel(null);
    setProductOpen(false);
    toast("Cleared");
  };

  const downloadAll = () => {
    const list = (favourites.length ? favourites : frames).slice(0, 12);
    const params = new URLSearchParams({ name: "aks-shoot" });
    for (const f of list) params.append("u", f.imageUrl);
    const a = document.createElement("a");
    a.href = `/api/photoreal/download-zip?${params.toString()}`;
    a.download = "aks-shoot.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const lightboxFrame = frames.find((f) => f.id === lightbox) ?? null;

  return (
    <Workbench
      input={
        <div className="max-w-xl">
          <PanelHead label="Your shoot" step="01" />

          {/* 1 · Dress */}
          <StudioSection title="1 · Your dress" first>
            <div
              role="radiogroup"
              aria-label="What the photo shows"
              className="mb-4 grid grid-cols-2 border border-ink/20 text-[12.5px] rounded-[2px]"
            >
              {(
                [
                  ["mannequin", "On a mannequin, hanger or flat"],
                  ["person", "Worn by a person"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={sourceKind === value}
                  disabled={shooting}
                  onClick={() => setSourceKind(value)}
                  className={cn(
                    "px-3 py-2 text-center transition-colors",
                    sourceKind === value
                      ? "bg-ink font-semibold text-milk"
                      : "text-ink/70 hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <StudioDropzone
              label="Drop dress photos here"
              sublabel={`Full view first · add the back and embroidery close-ups · up to ${MAX_GARMENT_REFERENCES}`}
              disabled={uploading}
              dragOver={dragOver}
              onDragEnter={() => setDragOver(true)}
              onDragLeave={() => setDragOver(false)}
              onDrop={(files) => void addPhotos(files)}
              onChoose={() => inputRef.current?.click()}
              inputRef={inputRef}
              onFileChange={(files) => void addPhotos(files)}
              multiple
            />
            <ThumbRow
              assets={photos.map(({ localPreview, name }) => ({ localPreview, name }))}
              onRemove={(i) => {
                const p = photos[i];
                if (p) URL.revokeObjectURL(p.localPreview);
                setPhotos((prev) => prev.filter((_, idx) => idx !== i));
              }}
              onMakeMain={(i) =>
                setPhotos((prev) => [prev[i]!, ...prev.filter((_, idx) => idx !== i)])
              }
            />
            <p className={studioHintClass}>
              {uploading
                ? "Uploading…"
                : "The dress is kept exactly and shown professionally pressed — only the model, pose and location change."}
            </p>
          </StudioSection>

          {/* 2 · Model */}
          <StudioSection title="2 · Model" className="mt-8">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[
                { id: RANDOM_HOUSE_MODEL_ID, name: "Any", cue: "We pick — same model for the whole shoot" },
                // Seven faces up front; the rest on demand (keeps the step short).
                ...(allModels
                  ? HOUSE_MODELS
                  : HOUSE_MODELS.filter(
                      (m, i) => i < 7 || m.id === houseModelId,
                    )),
              ].map(
                (m) => {
                  const selected = houseModelId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={selected}
                      title={m.cue}
                      onClick={() => setHouseModelId(m.id as HouseModelSelection)}
                      className={cn(
                        "flex items-center gap-2 border px-2 py-1.5 text-start text-[12.5px] transition-colors rounded-[2px]",
                        selected
                          ? "border-ink bg-ink text-milk"
                          : "border-ink/15 bg-milk/60 text-ink hover:border-ink/40",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                          selected ? "bg-zari text-indigo" : "bg-ink/10 text-ink",
                        )}
                      >
                        {m.id === RANDOM_HOUSE_MODEL_ID ? "∗" : m.name[0]}
                      </span>
                      <span className="truncate">{m.name}</span>
                    </button>
                  );
                },
              )}
            </div>
            {HOUSE_MODELS.length > 7 && (
              <button
                type="button"
                onClick={() => setAllModels((v) => !v)}
                className="mt-2 border-b border-ink/30 text-[12px] text-ink/75 hover:text-ink"
              >
                {allModels ? "Show fewer" : `Show all ${HOUSE_MODELS.length} models`}
              </button>
            )}
            <p className={studioHintClass}>
              {houseModelId === RANDOM_HOUSE_MODEL_ID
                ? lockedModel
                  ? `This shoot is using ${lockedModel.name} — she stays for every photo.`
                  : "We pick a model on the first photo and keep her for the whole shoot."
                : HOUSE_MODELS.find((m) => m.id === houseModelId)?.cue}
            </p>
          </StudioSection>

          {/* 3 · Location */}
          <StudioSection title="3 · Location" className="mt-8">
            <div role="tablist" aria-label="Location type" className="mb-3 flex gap-4 border-b border-ink/10">
              {STUDIO_BACKGROUND_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={locationGroup === g}
                  onClick={() => setLocationGroup(g)}
                  className={cn(
                    "-mb-px border-b-2 pb-1.5 text-[12px] font-semibold tracking-[0.04em] transition-colors",
                    locationGroup === g
                      ? "border-zari text-ink"
                      : "border-transparent text-ink/55 hover:text-ink",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {groupedStudioBackgrounds()
                .find((g) => g.group === locationGroup)!
                .presets.map((p) => {
                  const selected = location === p.id && !customLocation;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={selected}
                      title={p.prompt}
                      onClick={() => {
                        setLocation(p.id);
                        setCustomLocation("");
                      }}
                      className={cn(
                        "overflow-hidden border text-start transition rounded-[2px]",
                        selected ? "border-ink ring-1 ring-ink" : "border-ink/15 hover:border-ink/40",
                      )}
                    >
                      <span
                        aria-hidden
                        className="block h-12"
                        style={{
                          background: `linear-gradient(160deg, ${p.tone[0]} 0%, ${p.tone[1]} 100%)`,
                        }}
                      />
                      <span className="block bg-milk/80 px-2 py-1.5 text-[12px] leading-tight text-ink">
                        {p.label}
                      </span>
                    </button>
                  );
                })}
            </div>
            <label className={cn(studioLabelClass, "mt-4")} htmlFor="photo-custom-location">
              Or describe a location
            </label>
            <input
              id="photo-custom-location"
              className={studioFieldClass}
              placeholder="e.g. sunlit balcony with jasmine vines"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
            />
          </StudioSection>

          {/* 4 · Shots */}
          <StudioSection title="4 · Shots" className="mt-8">
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
              <button
                type="button"
                className="border-b border-ink/30 text-ink/75 hover:text-ink"
                onClick={() => setShots(["front"])}
              >
                Just the front
              </button>
              <button
                type="button"
                className="border-b border-ink/30 text-ink/75 hover:text-ink"
                onClick={() => setShots([...STANDARD_SET])}
              >
                Standard set (4)
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SHOTS.map((shot) => {
                const on = shots.includes(shot.id);
                return (
                  <button
                    key={shot.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleShot(shot.id)}
                    className={cn(
                      "border px-2.5 py-2 text-start transition-colors rounded-[2px]",
                      on ? "border-ink bg-ink text-milk" : "border-ink/15 bg-milk/60 text-ink hover:border-ink/40",
                    )}
                  >
                    <span className="block text-[12.5px] font-semibold">{shot.label}</span>
                    <span className={cn("block text-[11px] leading-snug", on ? "text-milk/75" : "text-ink/55")}>
                      {shot.id === "front" && sourceKind === "mannequin"
                        ? "As photographed"
                        : shot.hint}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              {noteOpen ? (
                <>
                  <label className={studioLabelClass} htmlFor="photo-note">
                    Styling note (optional)
                  </label>
                  <textarea
                    id="photo-note"
                    className={cn(studioFieldClass, "min-h-[64px] resize-y")}
                    placeholder='e.g. "hair in a low bun, soft morning light" — the dress itself never changes'
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  className="inline-flex items-center gap-1.5 text-[12px] text-ink/70 hover:text-ink"
                >
                  <PenLine className="size-3.5" /> Add a styling note
                </button>
              )}
            </div>
          </StudioSection>

          {error && (
            <p className="mt-5 text-[13px] text-madder" role="alert">
              {error}
            </p>
          )}

          <StudioActions>
            <Button
              type="button"
              disabled={!photos.length || !orderedShots.length || uploading || shooting}
              className={studioPrimaryButtonClass}
              onClick={() => void handleShoot()}
            >
              {shooting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Shooting…
                </>
              ) : !photos.length ? (
                "Add a dress photo to start"
              ) : !orderedShots.length ? (
                "Pick at least one shot"
              ) : (
                `Shoot ${orderedShots.length} photo${orderedShots.length === 1 ? "" : "s"} · ~PKR ${shootCostPkr.toLocaleString("en-PK")}`
              )}
            </Button>
            <button
              type="button"
              className="text-[12.5px] text-ink/60 underline-offset-2 hover:text-ink hover:underline"
              disabled={shooting}
              onClick={clearAll}
            >
              Start over
            </button>
          </StudioActions>
        </div>
      }
      output={
        // Stays in view while the brief on the left scrolls.
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pe-2">
          <PanelHead label="Contact sheet" step="02" />

          {photos.length > 0 && (
            <div className="mb-5 flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/55">
                Your dress
              </span>
              <div className="flex gap-1.5">
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.url}
                    src={p.localPreview}
                    alt={i === 0 ? "Main dress photo" : `Dress photo ${i + 1}`}
                    className={cn(
                      "h-14 w-11 object-cover border rounded-[2px]",
                      i === 0 ? "border-zari" : "border-ink/15",
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {frames.length === 0 && pending.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center border border-dashed border-ink/20 px-8 py-12 text-center rounded-[2px]">
              <p className="font-display text-[22px] text-ink">Your photos appear here</p>
              <ol className="mt-4 space-y-1 text-[12.5px] text-ink/65">
                <li>1 · Add photos of the dress</li>
                <li>2 · Pick a model and a location</li>
                <li>3 · Tick the shots you want, then Shoot</li>
              </ol>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] text-ink/65">
                  {frames.length} photo{frames.length === 1 ? "" : "s"}
                  {lockedModel ? ` · ${lockedModel.name}` : ""} · PKR{" "}
                  {Math.round(totalUsd * usdPkrRate).toLocaleString("en-PK")}
                  {favourites.length ? ` · ★ ${favourites.length}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!frames.length}
                    onClick={downloadAll}
                    className="rounded-[2px] border-ink/25 text-[12px] text-ink"
                  >
                    <Download className="size-3.5" />
                    {favourites.length ? `Download ★ ${favourites.length}` : "Download all"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!favourites.length}
                    onClick={() => setProductOpen((o) => !o)}
                    title={favourites.length ? undefined : "Star your best photos first"}
                    className="rounded-[2px] border border-zari bg-zari text-[12px] font-semibold text-indigo hover:bg-zari/90 disabled:border-ink/20 disabled:bg-transparent disabled:text-ink/40"
                  >
                    Add to product
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {!favourites.length && frames.length > 0 && (
                <p className="mb-4 text-[12px] text-ink/60">
                  Tip: tap ☆ on your best photos to send them to a product or download just those.
                </p>
              )}

              {productOpen && favourites.length > 0 && (
                <AddToProductPanel
                  favourites={favourites}
                  onClose={() => setProductOpen(false)}
                  onDone={(name) => {
                    setProductOpen(false);
                    toast(`Added to ${name}`);
                  }}
                />
              )}

              <div className="grid grid-cols-2 gap-3 xl:gap-4">
                {frames.map((frame) => {
                  const busy = busyFrames.has(frame.id);
                  const open = panel?.frameId === frame.id ? panel.kind : null;
                  return (
                    <figure key={frame.id} className="border border-ink/15 bg-milk/50 rounded-[2px]">
                      <div className="relative">
                        <button
                          type="button"
                          className="block w-full"
                          onClick={() => setLightbox(frame.id)}
                          aria-label={`Enlarge ${frame.label}`}
                        >
                          <FrameImage src={frame.imageUrl} alt={frame.label} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Download ${frame.label}`}
                          title="Download"
                          onClick={() =>
                            downloadImage(
                              frame.imageUrl,
                              `aks-${frame.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${frame.id.slice(0, 6)}.png`,
                            )
                          }
                          className="absolute start-2 top-2 flex size-8 items-center justify-center bg-milk/90 text-ink rounded-full hover:bg-milk"
                        >
                          <Download className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-pressed={frame.favourite}
                          aria-label={frame.favourite ? "Remove from favourites" : "Add to favourites"}
                          onClick={() =>
                            setFrames((prev) =>
                              prev.map((f) => (f.id === frame.id ? { ...f, favourite: !f.favourite } : f)),
                            )
                          }
                          className="absolute end-2 top-2 flex size-8 items-center justify-center bg-milk/90 text-ink rounded-full hover:bg-milk"
                        >
                          <Star className={cn("size-4", frame.favourite && "fill-zari text-zari")} />
                        </button>
                        {busy && (
                          <div className="absolute inset-0 flex items-center justify-center bg-ink/55 text-[12.5px] text-milk">
                            <Loader2 className="me-2 size-4 animate-spin" /> Creating variation…
                          </div>
                        )}
                      </div>
                      <figcaption className="px-2.5 pb-2.5 pt-2">
                        <p className="truncate text-[12.5px] font-semibold text-ink">{frame.label}</p>
                        <p className="truncate text-[11px] text-ink/55">
                          {presetLabel(frame.backgroundPreset)}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          <CardAction
                            label="New pose"
                            icon={<Move className="size-3.5" />}
                            disabled={busy}
                            onClick={() => {
                              const poseId = pickOther(VARIATION_POSES, frame.poseId);
                              void varyFrame(frame, { label: `${frame.label} · new pose`, poseId });
                            }}
                          />
                          <CardAction
                            label="Closer"
                            icon={<ZoomIn className="size-3.5" />}
                            disabled={busy}
                            onClick={() => void closerFrame(frame)}
                          />
                          <CardAction
                            label="Location"
                            icon={<MapPin className="size-3.5" />}
                            active={open === "location"}
                            disabled={busy}
                            onClick={() =>
                              setPanel(open === "location" ? null : { frameId: frame.id, kind: "location" })
                            }
                          />
                          <CardAction
                            label="Fix detail"
                            icon={<PenLine className="size-3.5" />}
                            active={open === "fix"}
                            disabled={busy}
                            onClick={() => {
                              setFixNote("");
                              setPanel(open === "fix" ? null : { frameId: frame.id, kind: "fix" });
                            }}
                          />
                        </div>

                        {open === "location" && (
                          <select
                            aria-label="New location"
                            className={cn(studioFieldClass, "mt-2 text-[12px]")}
                            defaultValue=""
                            onChange={(e) => {
                              const id = e.target.value;
                              if (!id) return;
                              setPanel(null);
                              void varyFrame(frame, {
                                label: `${frame.label} · ${presetLabel(id)}`,
                                backgroundPreset: id,
                              });
                            }}
                          >
                            <option value="" disabled>
                              Move to…
                            </option>
                            {groupedStudioBackgrounds().map(({ group, presets }) => (
                              <optgroup key={group} label={group}>
                                {presets.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        )}

                        {open === "fix" && (
                          <form
                            className="mt-2 flex gap-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!fixNote.trim()) return;
                              setPanel(null);
                              void varyFrame(frame, { label: `${frame.label} · fixed`, feedback: fixNote });
                            }}
                          >
                            <input
                              autoFocus
                              aria-label="What to fix"
                              className={cn(studioFieldClass, "text-[12px]")}
                              placeholder='e.g. "smile a bit more", "hands look stiff"'
                              value={fixNote}
                              onChange={(e) => setFixNote(e.target.value)}
                            />
                            <Button type="submit" size="sm" className="rounded-[2px] bg-ink text-[12px] text-milk">
                              Go
                            </Button>
                          </form>
                        )}
                      </figcaption>
                    </figure>
                  );
                })}

                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="flex aspect-[3/4] flex-col items-center justify-center gap-2 border border-dashed border-ink/20 bg-milk/40 text-center rounded-[2px]"
                  >
                    <Loader2 className="size-5 animate-spin text-ink/50" />
                    <p className="text-[12px] text-ink/65">Shooting {p.label.toLowerCase()}…</p>
                    <p className="text-[10.5px] text-ink/45">about 15–30 s</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {lightboxFrame && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={lightboxFrame.label}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
              onClick={() => setLightbox(null)}
              onKeyDown={(e) => e.key === "Escape" && setLightbox(null)}
            >
              <div className="relative flex max-h-full max-w-5xl gap-4" onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxFrame.imageUrl}
                  alt={lightboxFrame.label}
                  className="max-h-[88vh] w-auto object-contain"
                />
                {photos[0] && (
                  <div className="hidden w-40 shrink-0 md:block">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-milk/70">
                      Your dress
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photos[0].localPreview} alt="Original dress" className="w-full border border-milk/20" />
                  </div>
                )}
                <button
                  type="button"
                  autoFocus
                  aria-label="Close"
                  onClick={() => setLightbox(null)}
                  className="absolute -end-2 -top-2 flex size-8 items-center justify-center bg-milk text-ink rounded-full"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}

/** Result image with a placeholder until it has loaded. */
function FrameImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className="relative block aspect-[3/4] w-full bg-ink/5">
      {!loaded && (
        <span className="absolute inset-0 flex items-center justify-center text-[11.5px] text-ink/50">
          <Loader2 className="me-1.5 size-4 animate-spin" /> Loading photo…
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}

function CardAction({
  label,
  icon,
  onClick,
  disabled,
  active,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 border px-1.5 text-[11.5px] text-ink transition-colors rounded-[2px] disabled:opacity-40",
        active ? "border-ink bg-ink text-milk" : "border-ink/15 hover:border-ink/45",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Send starred photos to a design as its Front / Second / Back photos. */
function AddToProductPanel({
  favourites,
  onClose,
  onDone,
}: {
  favourites: Frame[];
  onClose: () => void;
  onDone: (designName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<StudioDesignOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [designId, setDesignId] = useState("");
  const [colourwayId, setColourwayId] = useState("");
  const [slots, setSlots] = useState<Record<string, ProductPhotoSlot | "">>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = favourites.slice(0, 3);

  // Sensible default slots: front shot → Front, back shot → Back, rest fill in.
  useEffect(() => {
    const order: ProductPhotoSlot[] = ["front", "second", "back"];
    const next: Record<string, ProductPhotoSlot | ""> = {};
    const used = new Set<ProductPhotoSlot>();
    for (const f of picked) {
      const wanted: ProductPhotoSlot =
        f.shotId === "back" ? "back" : f.shotId === "front" ? "front" : "second";
      const slot = !used.has(wanted) ? wanted : order.find((s) => !used.has(s));
      if (slot) {
        used.add(slot);
        next[f.id] = slot;
      }
    }
    setSlots(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked.map((f) => f.id).join(",")]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      void listStudioDesignOptionsAction(query).then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (res.ok) setOptions(res.designs);
        else setError(res.error);
      });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const design = options.find((d) => d.id === designId);
  useEffect(() => {
    if (!design) return;
    setColourwayId(
      design.colourways.find((c) => c.isDefault)?.id ?? design.colourways[0]?.id ?? "",
    );
  }, [design]);

  const chosen = picked.filter((f) => slots[f.id]);
  const slotValues = chosen.map((f) => slots[f.id]);
  const duplicate = new Set(slotValues).size !== slotValues.length;

  const submit = async () => {
    if (!design || !colourwayId || !chosen.length || duplicate) return;
    setSaving(true);
    setError(null);
    const res = await addPhotosToProductAction({
      designId: design.id,
      colourwayId,
      photos: chosen.map((f) => ({ imageUrl: f.imageUrl, slot: slots[f.id] as ProductPhotoSlot })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone(design.name);
  };

  return (
    <div className="mb-5 border border-ink/20 bg-milk/80 p-4 rounded-[2px]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12.5px] font-semibold text-ink">Add starred photos to a product</p>
        <button type="button" aria-label="Close" onClick={onClose} className="text-ink/60 hover:text-ink">
          <X className="size-4" />
        </button>
      </div>

      <label className={studioLabelClass} htmlFor="product-search">
        Product
      </label>
      <input
        id="product-search"
        className={studioFieldClass}
        placeholder="Search designs by name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-1.5 max-h-40 overflow-y-auto border border-ink/10 bg-milk rounded-[2px]">
        {loading ? (
          <p className="px-3 py-2 text-[12px] text-ink/55">Searching…</p>
        ) : options.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-ink/55">No designs found.</p>
        ) : (
          options.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDesignId(d.id)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-1.5 text-start text-[12.5px]",
                d.id === designId ? "bg-ink text-milk" : "text-ink hover:bg-ink/5",
              )}
            >
              <span className="truncate">{d.name}</span>
              <span className={cn("ms-2 shrink-0 text-[10.5px] uppercase", d.id === designId ? "text-milk/70" : "text-ink/45")}>
                {d.status.toLowerCase()}
              </span>
            </button>
          ))
        )}
      </div>

      {design && (
        <>
          <label className={cn(studioLabelClass, "mt-4")} htmlFor="product-colour">
            Colour
          </label>
          <select
            id="product-colour"
            className={studioFieldClass}
            value={colourwayId}
            onChange={(e) => setColourwayId(e.target.value)}
          >
            {design.colourways.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isDefault ? " (main)" : ""}
              </option>
            ))}
          </select>

          <p className={cn(studioLabelClass, "mt-4")}>Use each photo as</p>
          <div className="flex flex-wrap gap-3">
            {picked.map((f) => (
              <div key={f.id} className="w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.imageUrl} alt={f.label} className="aspect-[3/4] w-full object-cover border border-ink/15" />
                <select
                  aria-label={`Slot for ${f.label}`}
                  className={cn(studioFieldClass, "mt-1 px-1.5 py-1 text-[11.5px]")}
                  value={slots[f.id] ?? ""}
                  onChange={(e) =>
                    setSlots((prev) => ({ ...prev, [f.id]: e.target.value as ProductPhotoSlot | "" }))
                  }
                >
                  <option value="">Skip</option>
                  <option value="front">Front</option>
                  <option value="second">Second</option>
                  <option value="back">Back</option>
                </select>
              </div>
            ))}
          </div>
          {favourites.length > 3 && (
            <p className={studioHintClass}>A product shows three photos — the first three starred are used.</p>
          )}
          <p className={studioHintClass}>
            Replaces earlier AI photos in those slots. Real product photos are never changed.
          </p>
        </>
      )}

      {duplicate && <p className="mt-2 text-[12px] text-madder">Give each photo a different slot.</p>}
      {error && <p className="mt-2 text-[12px] text-madder">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!design || !chosen.length || duplicate || saving}
          onClick={() => void submit()}
          className={studioPrimaryButtonClass}
        >
          {saving ? "Adding…" : design ? `Add ${chosen.length} to ${design.name}` : "Pick a product"}
        </Button>
        {design && (
          <Link href={`/admin/designs/${design.id}`} className="text-[12px] text-ink/70 underline-offset-2 hover:underline">
            Open design
          </Link>
        )}
      </div>
    </div>
  );
}
