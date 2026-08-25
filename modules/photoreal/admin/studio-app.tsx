"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Images, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  generatePhotorealAction,
  getPhotorealSettingsAction,
  refinePhotorealAction,
  savePhotorealDesignAction,
} from "../actions";
import { usdToPkrAtRate } from "../currency";
import { FAL_MODEL_OPTIONS } from "../fal-config";
import {
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "../model-persona";
import type { PromptMode } from "../prompt-builder";

import { InputScreen } from "./input-screen";
import { ResultScreen, type StudioVersion } from "./result-screen";
import { SettingsPanel } from "./settings-panel";

type Phase = "input" | "result";

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
};

type ApiVersion = StudioVersion;

export function StudioApp() {
  const [phase, setPhase] = useState<Phase>("input");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Generating…");
  const [modelName, setModelName] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(null);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("");
  const [totalCost, setTotalCost] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);
  const [usdPkrRate, setUsdPkrRate] = useState(278);
  const [sketchPreviews, setSketchPreviews] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftMeta | null>(null);
  const [defaultHouseModelId, setDefaultHouseModelId] =
    useState<HouseModelSelection>(RANDOM_HOUSE_MODEL_ID);
  const [lastRefinePayload, setLastRefinePayload] = useState<{
    feedback: string;
    shirtColour?: string;
    trouserColour?: string;
    fabric?: string;
  } | null>(null);

  useEffect(() => {
    void getPhotorealSettingsAction()
      .then((data) => {
        if (data.ok && data.preferredHouseModelId) {
          setDefaultHouseModelId(data.preferredHouseModelId);
        }
      })
      .catch(() => undefined);
  }, []);

  const startOver = useCallback(() => {
    setPhase("input");
    setSavedDesignId(null);
    setVersions([]);
    setActiveVersionId("");
    setTotalCost(0);
    setSketchPreviews([]);
    setDraft(null);
    setError(null);
    setBusy(false);
    setLastRefinePayload(null);
  }, []);

  const handleGenerate = useCallback(
    async (payload: {
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
    }) => {
      setBusy(true);
      setBusyLabel("Generating…");
      setError(null);
      setSketchPreviews(payload.sketchPreviews);
      setSavedDesignId(null);
      try {
        try {
          const settings = await getPhotorealSettingsAction();
          if (settings.ok) {
            setModelName(
              FAL_MODEL_OPTIONS[settings.fal.generateModel]?.label ??
                "fal model",
            );
          } else {
            setModelName("fal model");
          }
        } catch {
          setModelName("fal model");
        }

        const data = await generatePhotorealAction({
          sourceMode: payload.sourceMode,
          sketchUrls: payload.sketchUrls,
          oldDesignUrls: payload.oldDesignUrls,
          oldDesignUrl: payload.oldDesignUrl ?? payload.oldDesignUrls[0],
          description: payload.description,
          shirtColour: payload.shirtColour,
          trouserColour: payload.trouserColour,
          fabric: payload.fabric,
          houseModelId: payload.houseModelId,
        });

        if (!data.ok || !data.version) {
          throw new Error(!data.ok ? data.error : "Generation failed.");
        }

        const callCost = data.costUsd ?? data.version.costUsd ?? data.totalCost;

        setDraft({
          description: payload.description,
          shirtColour: payload.shirtColour,
          trouserColour: payload.trouserColour,
          fabric: payload.fabric,
          sketchUrls: payload.sketchUrls,
          oldDesignUrl: payload.oldDesignUrl ?? payload.oldDesignUrls[0],
          houseModelId: data.houseModel?.id ?? "ayesha",
          houseModelName: data.houseModel?.name ?? "Ayesha",
          promptMode: data.promptMode ?? payload.sourceMode,
        });
        setVersions([data.version]);
        setActiveVersionId(data.version.id);
        setTotalCost(data.totalCost);
        setSessionCost((s) => s + callCost);
        if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
        setPhase("result");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleRefine = useCallback(
    async (payload: {
      feedback: string;
      shirtColour?: string;
      trouserColour?: string;
      fabric?: string;
    }) => {
      const active = versions.find((v) => v.id === activeVersionId);
      if (!active || !draft) return;
      setLastRefinePayload(payload);
      setBusy(true);
      setBusyLabel("Refining…");
      setError(null);
      try {
        try {
          const settings = await getPhotorealSettingsAction();
          if (settings.ok) {
            setModelName(
              FAL_MODEL_OPTIONS[settings.fal.refineModel]?.label ?? "fal model",
            );
          }
        } catch {
          /* keep previous label */
        }

        const nextShirt = payload.shirtColour ?? draft.shirtColour;
        const nextTrouser = payload.trouserColour ?? draft.trouserColour;
        const nextFabric = payload.fabric ?? draft.fabric;

        const data = await refinePhotorealAction({
          baseImageUrl: active.imageUrl,
          sketchUrls: draft.sketchUrls,
          oldDesignUrl: draft.oldDesignUrl,
          parentVersionId: active.id,
          description: draft.description,
          shirtColour: nextShirt,
          trouserColour: nextTrouser,
          fabric: nextFabric,
          feedback: payload.feedback,
          previousTotalCost: totalCost,
          houseModelId: draft.houseModelId,
          promptMode: draft.promptMode,
        });

        if (!data.ok || !data.version) {
          throw new Error(!data.ok ? data.error : "Refine failed.");
        }

        const callCost = data.costUsd ?? data.version.costUsd ?? 0;

        setDraft((d) =>
          d
            ? {
                ...d,
                shirtColour: nextShirt,
                trouserColour: nextTrouser,
                fabric: nextFabric,
              }
            : d,
        );
        setVersions((prev) => [...prev, data.version]);
        setActiveVersionId(data.version.id);
        setTotalCost(data.totalCost);
        setSessionCost((s) => s + callCost);
        if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Refine failed.");
      } finally {
        setBusy(false);
      }
    },
    [versions, activeVersionId, draft, totalCost],
  );

  const handleSave = useCallback(async () => {
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
  }, [draft, versions, savedDesignId]);

  return (
    <div className="text-greige">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-lift pb-3">
        <p className="font-display text-lg text-greige">Sketch → Photoreal</p>
        <div className="flex items-center gap-2">
          {sessionCost > 0 && (
            <span
              className="hidden text-[11px] text-chalk sm:inline"
              title={`Rate Rs ${usdPkrRate} / USD`}
            >
              session PKR{" "}
              {usdToPkrAtRate(sessionCost, usdPkrRate).toLocaleString("en-PK")}
            </span>
          )}
          <Link
            href="/admin/photoreal/gallery"
            className="inline-flex items-center gap-1.5 border border-indigo-lift px-2 py-1 text-[13px] text-zari rounded-[2px]"
          >
            <Images className="size-4" />
            Gallery
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-[2px] text-[13px] text-chalk hover:text-greige"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-4" />
            Settings
          </Button>
        </div>
      </header>

      {phase === "input" && (
        <>
          <InputScreen
            disabled={busy}
            defaultHouseModelId={defaultHouseModelId}
            sessionCostPkr={
              sessionCost > 0
                ? usdToPkrAtRate(sessionCost, usdPkrRate)
                : undefined
            }
            onGenerate={handleGenerate}
          />
          {busy && (
            <p className="mx-auto mt-6 max-w-3xl text-center text-[13px] text-chalk">
              Generating with {modelName || "fal"}… this can take a short while.
            </p>
          )}
          {error && (
            <p className="mx-auto mt-4 max-w-3xl text-center text-[13px] text-madder">
              {error}
            </p>
          )}
        </>
      )}

      {phase === "result" && (
        <ResultScreen
          designId={savedDesignId ?? "draft"}
          versions={versions}
          activeVersionId={activeVersionId}
          totalCost={totalCost}
          sessionCost={sessionCost}
          usdPkrRate={usdPkrRate}
          sketchPreviews={sketchPreviews}
          modelName={modelName}
          houseModelName={draft?.houseModelName}
          busy={busy}
          busyLabel={busyLabel}
          error={error}
          onSelectVersion={setActiveVersionId}
          onRefine={handleRefine}
          onSave={handleSave}
          onStartOver={startOver}
          onRetry={
            lastRefinePayload
              ? () => void handleRefine(lastRefinePayload)
              : undefined
          }
        />
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => setDefaultHouseModelId(s.preferredHouseModelId)}
      />
    </div>
  );
}
