"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getPhotorealSettingsAction,
  savePhotorealSettingsAction,
} from "../actions";
import { usdToPkrAtRate } from "../currency";
import { FAL_MODEL_OPTIONS, type FalModelKey } from "../fal-config";
import {
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "../model-persona";

import { SettingsPanel } from "./settings-panel";
import { FabricTab } from "./studio/fabric-tab";
import { PhotographTab } from "./studio/photograph-tab";
import { RenderTab } from "./studio/render-tab";
import { SizingTab } from "./studio/sizing-tab";
import {
  StudioShell,
  StudioToastProvider,
  useStudioToast,
  type StudioQuality,
  type StudioTabId,
} from "./studio/studio-primitives";

const SUBTITLES: Record<StudioTabId, React.ReactNode> = {
  photograph: (
    <>
      Have the dress? Upload photos of it — on a mannequin, a hanger, laid flat
      or worn — and get{" "}
      <span className="font-semibold text-ink">
        catalogue photographs on a real model
      </span>
      . The dress is kept exactly and shown pressed; you choose the model,
      location and shots.
    </>
  ),
  create: (
    <>
      For new ideas that don&apos;t exist as a dress yet: turn a{" "}
      <span className="font-semibold text-ink">sketch</span>, an inspiration
      photo, or a <span className="font-semibold text-ink">written brief</span>{" "}
      into a photograph on a catalogue model.
    </>
  ),
  fabric: (
    <>
      Upload a{" "}
      <span className="font-semibold text-ink">flat photo of a fabric</span>{" "}
      swatch and get one catalogue photograph — same colour, same weave —
      styled as a spiral drape.
    </>
  ),
  sizing: (
    <>
      Upload a photo of the garment. AI Studio reads the style, builds a{" "}
      <span className="font-semibold text-ink">ghost mannequin</span> with
      measurement lines and the standard XS–XXL chart of finished-garment
      measurements.
    </>
  ),
};

/** Quality tier → image model (generate and refine use the same one). */
const QUALITY_MODEL: Record<StudioQuality, FalModelKey> = {
  standard: "nano-banana-edit",
  high: "nano-banana-2-edit",
};

function qualityFor(model: FalModelKey): StudioQuality {
  return model === "nano-banana-2-edit" ? "high" : "standard";
}

export function StudioApp() {
  return (
    <StudioToastProvider>
      <StudioAppInner />
    </StudioToastProvider>
  );
}

function StudioAppInner() {
  const toast = useStudioToast();
  const [tab, setTab] = useState<StudioTabId>("photograph");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);
  const [usdPkrRate] = useState(278);
  const [quality, setQuality] = useState<StudioQuality>("standard");
  const [defaultHouseModelId, setDefaultHouseModelId] =
    useState<HouseModelSelection>(RANDOM_HOUSE_MODEL_ID);

  useEffect(() => {
    void getPhotorealSettingsAction()
      .then((data) => {
        if (!data.ok) return;
        if (data.preferredHouseModelId) {
          setDefaultHouseModelId(data.preferredHouseModelId);
        }
        setQuality(qualityFor(data.fal.generateModel));
      })
      .catch(() => undefined);
  }, []);

  const onSessionCost = useCallback((deltaUsd: number) => {
    setSessionCost((s) => s + deltaUsd);
  }, []);

  const changeQuality = useCallback(
    async (next: StudioQuality) => {
      const previous = quality;
      setQuality(next);
      const model = QUALITY_MODEL[next];
      const res = await savePhotorealSettingsAction({
        fal: { generateModel: model, refineModel: model },
      });
      if (!res.ok) {
        setQuality(previous);
        toast("Could not change quality — try again");
        return;
      }
      toast(
        next === "high"
          ? "High detail on — sharper embroidery, about 2× cost"
          : "Standard quality on",
      );
    },
    [quality, toast],
  );

  const perImagePkr = usdToPkrAtRate(
    FAL_MODEL_OPTIONS[QUALITY_MODEL[quality]].estimatedCostUsd,
    usdPkrRate,
  );
  const sessionCostPkr =
    sessionCost > 0 ? usdToPkrAtRate(sessionCost, usdPkrRate) : undefined;

  return (
    <>
      <StudioShell
        tab={tab}
        onTabChange={setTab}
        subtitle={SUBTITLES[tab]}
        onOpenSettings={() => setSettingsOpen(true)}
        quality={quality}
        onQualityChange={(q) => void changeQuality(q)}
      >
        {tab === "photograph" && (
          <PhotographTab
            defaultHouseModelId={defaultHouseModelId}
            perImagePkr={perImagePkr}
            usdPkrRate={usdPkrRate}
            onSessionCost={onSessionCost}
          />
        )}
        {tab === "create" && (
          <RenderTab
            defaultHouseModelId={defaultHouseModelId}
            sessionCostPkr={sessionCostPkr}
            usdPkrRate={usdPkrRate}
            perImagePkr={perImagePkr}
            onSessionCost={onSessionCost}
          />
        )}
        {tab === "fabric" && <FabricTab />}
        {tab === "sizing" && <SizingTab />}
      </StudioShell>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => {
          setDefaultHouseModelId(s.preferredHouseModelId);
          setQuality(qualityFor(s.fal.generateModel));
        }}
      />
    </>
  );
}
