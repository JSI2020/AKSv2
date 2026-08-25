"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { uploadPhotorealFilesAction } from "../actions";
import {
  HOUSE_MODELS,
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "../model-persona";
import { INPUT_SOURCE_TABS, type PromptMode } from "../prompt-builder";

export type UploadedAsset = {
  localPreview: string;
  url: string;
  name: string;
};

type InputScreenProps = {
  disabled?: boolean;
  defaultHouseModelId?: HouseModelSelection;
  sessionCostPkr?: number;
  onGenerate: (payload: {
    sourceMode: PromptMode;
    sketchUrls: string[];
    oldDesignUrls: string[];
    oldDesignUrl?: string;
    description: string;
    shirtColour: string;
    trouserColour: string;
    fabric: string;
    sketchPreviews: string[];
    houseModelId: HouseModelSelection;
  }) => Promise<void>;
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

const fieldClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige rounded-[2px]";
const labelClass = "text-[13px] text-greige";

export function InputScreen({
  disabled,
  defaultHouseModelId = RANDOM_HOUSE_MODEL_ID,
  sessionCostPkr,
  onGenerate,
}: InputScreenProps) {
  const sketchInputRef = useRef<HTMLInputElement>(null);
  const oldInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<PromptMode>("sketch");
  const [sketches, setSketches] = useState<UploadedAsset[]>([]);
  const [oldDesigns, setOldDesigns] = useState<UploadedAsset[]>([]);
  const [description, setDescription] = useState("");
  const [shirtColour, setShirtColour] = useState("");
  const [trouserColour, setTrouserColour] = useState("");
  const [fabric, setFabric] = useState("");
  const [houseModelId, setHouseModelId] =
    useState<HouseModelSelection>(defaultHouseModelId);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setHouseModelId(defaultHouseModelId);
  }, [defaultHouseModelId]);

  const canGenerate =
    sourceMode === "sketch"
      ? sketches.length > 0
      : sourceMode === "old-design"
        ? oldDesigns.length > 0
        : Boolean(description.trim());

  const addSketches = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(list, "sketch");
      setSketches((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sketch upload failed.");
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
      setError(err instanceof Error ? err.message : "Old design upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  const resetInputs = () => {
    sketches.forEach((s) => URL.revokeObjectURL(s.localPreview));
    oldDesigns.forEach((s) => URL.revokeObjectURL(s.localPreview));
    setSketches([]);
    setOldDesigns([]);
    setDescription("");
    setShirtColour("");
    setTrouserColour("");
    setFabric("");
    setError(null);
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-greige">Sketch → Photoreal</h1>
        <p className="max-w-xl text-[13px] leading-relaxed text-chalk">
          Pick one starting option. Catalogue model is always used; description
          and colours are optional except on Description.
        </p>
        {sessionCostPkr != null && sessionCostPkr > 0 && (
          <p className="text-[12px] text-chalk">
            Session total use: PKR {sessionCostPkr.toLocaleString("en-PK")}
          </p>
        )}
      </header>

      <div
        className="grid grid-cols-3 gap-px border border-indigo-lift bg-indigo-lift"
        role="tablist"
        aria-label="How to start"
      >
        {INPUT_SOURCE_TABS.map((tab) => {
          const active = sourceMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => {
                setSourceMode(tab.id);
                setError(null);
              }}
              className={cn(
                "bg-indigo px-2 py-2.5 text-center text-[13px] transition",
                active ? "text-greige" : "text-chalk hover:text-greige",
              )}
            >
              <span className="block font-medium">{tab.label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-snug text-chalk sm:block">
                {tab.hint}
              </span>
            </button>
          );
        })}
      </div>

      {sourceMode === "sketch" && (
        <div className="space-y-3">
          <p className="text-[13px] text-chalk">
            <span className="text-greige">Required:</span> one or more sketches.
            Description, colours and fabric are optional.
          </p>
          <DropZone
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDrop={(files) => void addSketches(files)}
            label="Drop sketches here"
            disabled={disabled || uploading}
            onChoose={() => sketchInputRef.current?.click()}
            inputRef={sketchInputRef}
            onChange={(files) => void addSketches(files)}
          />
          <AssetRow
            assets={sketches}
            onRemove={(i) => {
              const s = sketches[i];
              if (s) URL.revokeObjectURL(s.localPreview);
              setSketches((prev) => prev.filter((_, idx) => idx !== i));
            }}
          />
        </div>
      )}

      {sourceMode === "old-design" && (
        <div className="space-y-3">
          <p className="text-[13px] text-chalk">
            <span className="text-greige">Required:</span> one or more old design
            photos. The house model replaces the person in the photo.
          </p>
          <DropZone
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDrop={(files) => void addOldDesigns(files)}
            label="Drop old design photos here"
            disabled={disabled || uploading}
            onChoose={() => oldInputRef.current?.click()}
            inputRef={oldInputRef}
            onChange={(files) => void addOldDesigns(files)}
          />
          <AssetRow
            assets={oldDesigns}
            onRemove={(i) => {
              const s = oldDesigns[i];
              if (s) URL.revokeObjectURL(s.localPreview);
              setOldDesigns((prev) => prev.filter((_, idx) => idx !== i));
            }}
          />
        </div>
      )}

      {sourceMode === "description" && (
        <div className="border border-indigo-lift p-3">
          <p className="text-[13px] text-chalk">
            <span className="text-greige">Required:</span> catalogue model +
            written description. No sketch or photo upload.
          </p>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Catalogue model *</span>
        <select
          className={fieldClass}
          value={houseModelId}
          disabled={disabled}
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
        <span className="text-[11px] text-chalk">
          Same model stays locked while you refine one design.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>
          Description
          {sourceMode === "description" ? " *" : " (optional)"}
        </span>
        <textarea
          className={fieldClass}
          placeholder={
            sourceMode === "description"
              ? 'Required — e.g. "emerald lawn kameez with ivory palazzo"'
              : 'Optional — e.g. "make it festive, warmer lighting"'
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={sourceMode === "description" ? 4 : 3}
          disabled={disabled}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Shirt colour</span>
          <input
            className={fieldClass}
            placeholder="optional"
            value={shirtColour}
            onChange={(e) => setShirtColour(e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Trouser colour</span>
          <input
            className={fieldClass}
            placeholder="optional"
            value={trouserColour}
            onChange={(e) => setTrouserColour(e.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Fabric</span>
          <input
            className={fieldClass}
            placeholder="optional"
            value={fabric}
            onChange={(e) => setFabric(e.target.value)}
            disabled={disabled}
          />
        </label>
      </div>

      {error && (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!canGenerate || disabled || uploading}
          className="rounded-[2px] border border-zari bg-transparent text-[13px] text-zari hover:bg-indigo-lift"
          onClick={() => {
            const oldUrls =
              sourceMode === "old-design" ? oldDesigns.map((s) => s.url) : [];
            void onGenerate({
              sourceMode,
              sketchUrls:
                sourceMode === "sketch" ? sketches.map((s) => s.url) : [],
              oldDesignUrls: oldUrls,
              oldDesignUrl: oldUrls[0],
              description,
              shirtColour,
              trouserColour,
              fabric,
              sketchPreviews:
                sourceMode === "sketch"
                  ? sketches.map((s) => s.localPreview)
                  : sourceMode === "old-design"
                    ? oldDesigns.map((s) => s.localPreview)
                    : [],
              houseModelId,
            });
          }}
        >
          {uploading ? "Uploading…" : "Generate"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="rounded-[2px] text-[13px] text-chalk hover:text-greige"
          onClick={resetInputs}
        >
          Clear
        </Button>
      </div>
    </section>
  );
}

function DropZone({
  dragOver,
  setDragOver,
  onDrop,
  label,
  disabled,
  onChoose,
  inputRef,
  onChange,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onDrop: (files: FileList) => void;
  label: string;
  disabled?: boolean;
  onChoose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (files: FileList) => void;
}) {
  return (
    <div
      className={cn(
        "border border-dashed px-4 py-10 text-center transition-colors rounded-[2px]",
        dragOver ? "border-zari bg-indigo-lift/40" : "border-indigo-lift",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop(e.dataTransfer.files);
      }}
    >
      <ImagePlus className="mx-auto mb-3 size-7 text-chalk" />
      <p className="text-[13px] text-greige">{label}</p>
      <p className="mt-1 text-[11px] text-chalk">PNG, JPG, WEBP — multiple OK</p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 rounded-[2px] border-indigo-lift text-[13px] text-greige"
        disabled={disabled}
        onClick={onChoose}
      >
        Choose files
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onChange(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function AssetRow({
  assets,
  onRemove,
}: {
  assets: UploadedAsset[];
  onRemove: (index: number) => void;
}) {
  if (!assets.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {assets.map((s, i) => (
        <div key={`${s.url}-${i}`} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.localPreview}
            alt={s.name}
            className="size-24 object-cover border border-indigo-lift rounded-[2px]"
          />
          <button
            type="button"
            className="absolute -end-1.5 -top-1.5 bg-ink p-0.5 text-greige rounded-[2px]"
            aria-label="Remove"
            onClick={() => onRemove(i)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
