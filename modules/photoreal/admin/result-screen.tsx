"use client";

import { Download, RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { usdToPkrAtRate } from "../currency";
import { POSE_PRESETS } from "../prompt-builder";

export type StudioVersion = {
  id: string;
  imageUrl: string;
  feedback?: string | null;
  costUsd: number;
  modelId: string;
  createdAt?: string | Date;
  prompt?: string;
  negativePrompt?: string | null;
  seed?: number | null;
  parentVersionId?: string | null;
  requestId?: string | null;
};

const QUICK_CHIPS = [
  "Change shirt colour",
  "Change trouser colour",
  "Change fabric",
  "More embroidery",
  "Less embroidery",
  "Warmer lighting",
  "Real outdoor courtyard background",
  "Marble foyer background",
  "Garden path background",
  "Clearer fabric texture",
] as const;

const fieldClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige rounded-[2px] w-full";

type ResultScreenProps = {
  designId: string;
  versions: StudioVersion[];
  activeVersionId: string;
  totalCost: number;
  sessionCost?: number;
  usdPkrRate?: number;
  sketchPreviews: string[];
  modelName?: string;
  houseModelName?: string;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  onSelectVersion: (id: string) => void;
  onRefine: (payload: {
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
  }) => Promise<void>;
  onSave: () => Promise<void>;
  onStartOver: () => void;
  onRetry?: () => void;
};

export function ResultScreen({
  designId,
  versions,
  activeVersionId,
  totalCost,
  sessionCost = 0,
  usdPkrRate = 278,
  sketchPreviews,
  modelName,
  houseModelName,
  busy,
  busyLabel,
  error,
  onSelectVersion,
  onRefine,
  onSave,
  onStartOver,
  onRetry,
}: ResultScreenProps) {
  const [feedback, setFeedback] = useState("");
  const [shirtColour, setShirtColour] = useState("");
  const [trouserColour, setTrouserColour] = useState("");
  const [fabric, setFabric] = useState("");
  const [compare, setCompare] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const active = useMemo(
    () => versions.find((v) => v.id === activeVersionId) ?? versions.at(-1),
    [versions, activeVersionId],
  );

  if (!active) return null;

  const designPkr = usdToPkrAtRate(totalCost, usdPkrRate);
  const sessionPkr = usdToPkrAtRate(sessionCost, usdPkrRate);
  const lastCallPkr = usdToPkrAtRate(active.costUsd || 0, usdPkrRate);

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-chalk">
            {designId === "draft"
              ? "Unsaved draft"
              : `Design ${designId.slice(0, 8)}`}
          </p>
          <h2 className="font-display text-2xl text-greige sm:text-3xl">
            Result
          </h2>
          <p className="mt-1 text-[13px] text-chalk">
            this design: PKR {designPkr.toLocaleString("en-PK")} ·{" "}
            {versions.length} version{versions.length === 1 ? "" : "s"}
            {houseModelName ? ` · model ${houseModelName}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-chalk">
            last call: PKR {lastCallPkr.toLocaleString("en-PK")}
            {sessionCost > 0
              ? ` · session: PKR ${sessionPkr.toLocaleString("en-PK")}`
              : ""}
            {" · "}
            rate Rs {usdPkrRate}/USD
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-[2px] border-indigo-lift text-[13px] text-greige"
            onClick={() => setCompare((c) => !c)}
          >
            {compare ? "Hide compare" : "Compare sketch"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-[2px] border-indigo-lift text-[13px] text-greige"
            onClick={onStartOver}
          >
            <RotateCcw className="size-4" />
            Start over
          </Button>
        </div>
      </div>

      <div
        className={`grid gap-3 ${compare && sketchPreviews[0] ? "md:grid-cols-2" : ""}`}
      >
        {compare && sketchPreviews[0] && (
          <div className="overflow-hidden border border-indigo-lift rounded-[2px]">
            <p className="border-b border-indigo-lift px-3 py-2 text-[11px] text-chalk">
              Original sketch
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sketchPreviews[0]}
              alt="Original sketch"
              className="mx-auto max-h-[70vh] w-full object-contain"
            />
          </div>
        )}
        <div className="relative overflow-hidden border border-indigo-lift rounded-[2px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.imageUrl}
            alt="Generated result"
            className="mx-auto max-h-[70vh] w-full object-contain"
          />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-indigo/80">
              <div className="px-4 text-center">
                <p className="text-[13px] text-greige">
                  {busyLabel || "Generating…"}
                </p>
                {modelName && (
                  <p className="mt-1 text-[11px] text-chalk">{modelName}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {versions.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelectVersion(v.id)}
            className={`shrink-0 overflow-hidden border-2 transition rounded-[2px] ${
              v.id === active.id
                ? "border-zari"
                : "border-transparent opacity-80 hover:opacity-100"
            }`}
            title={v.feedback || `Version ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.imageUrl}
              alt={`Version ${i + 1}`}
              className="h-20 w-14 object-cover"
            />
          </button>
        ))}
      </div>

      <div className="space-y-4 border border-indigo-lift p-4 rounded-[2px]">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">Feedback</span>
          <textarea
            className={fieldClass}
            placeholder='e.g. "make the shirt deep red and add embroidery"'
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            disabled={busy}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              className="border border-indigo-lift px-2 py-1 text-[11px] text-chalk hover:border-zari hover:text-greige rounded-[2px]"
              onClick={() =>
                setFeedback((prev) =>
                  prev ? `${prev}; ${chip.toLowerCase()}` : chip,
                )
              }
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[13px] text-greige">Pose / angle</p>
          <p className="text-[11px] text-chalk">
            Refine with a new fashion-photography stance (same dress + house
            model).
          </p>
          <div className="flex flex-wrap gap-2">
            {POSE_PRESETS.map((pose) => (
              <Button
                key={pose.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className="rounded-[2px] border-indigo-lift text-[12px] text-greige"
                onClick={() => void onRefine({ feedback: pose.feedback })}
              >
                {pose.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-greige">Shirt colour</span>
            <input
              className={fieldClass}
              value={shirtColour}
              onChange={(e) => setShirtColour(e.target.value)}
              disabled={busy}
              placeholder="optional"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-greige">Trouser colour</span>
            <input
              className={fieldClass}
              value={trouserColour}
              onChange={(e) => setTrouserColour(e.target.value)}
              disabled={busy}
              placeholder="optional"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-greige">Fabric</span>
            <input
              className={fieldClass}
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              disabled={busy}
              placeholder="optional"
            />
          </label>
        </div>

        {error && (
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-madder">
            <span role="alert">{error}</span>
            {onRetry && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-[2px] border-indigo-lift text-greige"
                onClick={onRetry}
              >
                Retry
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={
              busy ||
              (!feedback.trim() && !shirtColour && !trouserColour && !fabric)
            }
            className="rounded-[2px] border border-zari bg-transparent text-[13px] text-zari hover:bg-indigo-lift"
            onClick={() =>
              void onRefine({
                feedback: feedback.trim(),
                shirtColour: shirtColour || undefined,
                trouserColour: trouserColour || undefined,
                fabric: fabric || undefined,
              }).then(() => setFeedback(""))
            }
          >
            Refine
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="rounded-[2px] border-indigo-lift text-[13px] text-greige"
            onClick={() => {
              const a = document.createElement("a");
              a.href = active.imageUrl;
              a.download = `photoreal-${active.id.slice(0, 8)}.png`;
              a.target = "_blank";
              a.rel = "noopener";
              a.click();
            }}
          >
            <Download className="size-4" />
            Download
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="rounded-[2px] border-indigo-lift text-[13px] text-greige"
            onClick={() =>
              void onSave().then(() => {
                setSavedMsg("Saved to gallery");
                setTimeout(() => setSavedMsg(null), 2500);
              })
            }
          >
            <Save className="size-4" />
            Save
          </Button>
          {savedMsg && (
            <span className="self-center text-[11px] text-chalk">{savedMsg}</span>
          )}
        </div>
      </div>
    </section>
  );
}
