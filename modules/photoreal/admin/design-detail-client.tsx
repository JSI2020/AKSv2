"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import {
  getPhotorealDesignAction,
  getPhotorealSettingsAction,
  refinePhotorealAction,
  savePhotorealDesignAction,
} from "../actions";
import { FAL_MODEL_OPTIONS } from "../fal-config";
import type { PromptMode } from "../prompt-builder";

import { ResultScreen, type StudioVersion } from "./result-screen";
import { SettingsPanel } from "./settings-panel";

type ApiVersion = StudioVersion;

export function DesignDetailClient({ designId }: { designId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const [usdPkrRate, setUsdPkrRate] = useState(278);
  const [sketchUrls, setSketchUrls] = useState<string[]>([]);
  const [meta, setMeta] = useState({
    description: "",
    shirtColour: "",
    trouserColour: "",
    fabric: "",
    oldDesignUrl: undefined as string | undefined,
    houseModelId: "ayesha",
    houseModelName: "Ayesha",
    promptMode: "sketch" as PromptMode,
  });
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Refining…");
  const [modelName, setModelName] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastRefinePayload, setLastRefinePayload] = useState<{
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPhotorealDesignAction(designId);
      if (!data.ok) throw new Error(data.error);
      setVersions(data.versions);
      setActiveVersionId(data.versions.at(-1)?.id ?? "");
      setTotalCost(data.totalCost);
      if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
      setSketchUrls(data.sketchUrls);
      setMeta({
        description: data.description ?? "",
        shirtColour: data.shirtColour ?? "",
        trouserColour: data.trouserColour ?? "",
        fabric: data.fabric ?? "",
        oldDesignUrl: data.oldDesignUrl ?? undefined,
        houseModelId: data.houseModelId ?? "ayesha",
        houseModelName: data.houseModelName ?? "Ayesha",
        promptMode: data.sketchUrls.length
          ? "sketch"
          : data.oldDesignUrl
            ? "old-design"
            : "description",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load design.");
    } finally {
      setLoading(false);
    }
  }, [designId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefine = async (payload: {
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
  }) => {
    const active = versions.find((v) => v.id === activeVersionId);
    if (!active) return;
    setLastRefinePayload(payload);
    setBusy(true);
    setBusyLabel("Refining…");
    setError(null);
    try {
      const settings = await getPhotorealSettingsAction();
      if (settings.ok) {
        setModelName(
          FAL_MODEL_OPTIONS[settings.fal.refineModel]?.label ?? "fal model",
        );
      }

      const nextShirt = payload.shirtColour ?? meta.shirtColour;
      const nextTrouser = payload.trouserColour ?? meta.trouserColour;
      const nextFabric = payload.fabric ?? meta.fabric;

      const data = await refinePhotorealAction({
        baseImageUrl: active.imageUrl,
        sketchUrls,
        oldDesignUrl: meta.oldDesignUrl,
        parentVersionId: active.id,
        description: meta.description,
        shirtColour: nextShirt,
        trouserColour: nextTrouser,
        fabric: nextFabric,
        feedback: payload.feedback,
        previousTotalCost: totalCost,
        houseModelId: meta.houseModelId,
        promptMode: meta.promptMode,
      });

      if (!data.ok || !data.version) {
        throw new Error(!data.ok ? data.error : "Refine failed.");
      }

      setMeta((m) => ({
        ...m,
        shirtColour: nextShirt,
        trouserColour: nextTrouser,
        fabric: nextFabric,
      }));
      setVersions((prev) => [...prev, data.version]);
      setActiveVersionId(data.version.id);
      setTotalCost(data.totalCost);
      if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refine failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const data = await savePhotorealDesignAction({
      designId,
      description: meta.description,
      shirtColour: meta.shirtColour,
      trouserColour: meta.trouserColour,
      fabric: meta.fabric,
      sketchUrls,
      oldDesignUrl: meta.oldDesignUrl,
      houseModelId: meta.houseModelId,
      houseModelName: meta.houseModelName,
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
  };

  if (loading) {
    return <p className="text-[13px] text-chalk">Loading design…</p>;
  }

  if (error && !versions.length) {
    return (
      <div className="space-y-3">
        <Link
          href="/admin/photoreal/gallery"
          className="inline-flex items-center gap-1.5 text-[13px] text-zari"
        >
          <ArrowLeft className="size-4" />
          Gallery
        </Link>
        <p className="text-[13px] text-madder">{error}</p>
      </div>
    );
  }

  return (
    <div className="text-greige">
      <header className="mb-6 flex items-center justify-between border-b border-indigo-lift pb-3">
        <Link
          href="/admin/photoreal/gallery"
          className="inline-flex items-center gap-1.5 text-[13px] text-zari"
        >
          <ArrowLeft className="size-4" />
          Gallery
        </Link>
        <button
          type="button"
          className="text-[13px] text-chalk hover:text-greige"
          onClick={() => setSettingsOpen(true)}
        >
          Settings
        </button>
      </header>

      <ResultScreen
        designId={designId}
        versions={versions}
        activeVersionId={activeVersionId}
        totalCost={totalCost}
        usdPkrRate={usdPkrRate}
        sketchPreviews={sketchUrls}
        modelName={modelName}
        houseModelName={meta.houseModelName}
        busy={busy}
        busyLabel={busyLabel}
        error={error}
        onSelectVersion={setActiveVersionId}
        onRefine={handleRefine}
        onSave={handleSave}
        onStartOver={() => {
          window.location.href = "/admin/photoreal";
        }}
        onRetry={
          lastRefinePayload
            ? () => void handleRefine(lastRefinePayload)
            : undefined
        }
      />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
