"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getPhotorealSettingsAction,
} from "../actions";
import { usdToPkrAtRate } from "../currency";
import {
  RANDOM_HOUSE_MODEL_ID,
  type HouseModelSelection,
} from "../model-persona";

import { SettingsPanel } from "./settings-panel";
import { FabricTab } from "./studio/fabric-tab";
import { RenderTab } from "./studio/render-tab";
import { SizingTab } from "./studio/sizing-tab";
import {
  StudioShell,
  StudioToastProvider,
  type StudioTabId,
} from "./studio/studio-primitives";

const SUBTITLES: Record<StudioTabId, React.ReactNode> = {
  render: (
    <>
      Turn a sketch, an earlier design, or a written brief into a
      catalogue-ready photograph. A{" "}
      <span className="font-semibold text-greige">
        catalogue model is always applied
      </span>
      ; description, colours and fabric are optional — except in Description
      mode, where the brief does the work.
    </>
  ),
  fabric: (
    <>
      Upload a{" "}
      <span className="font-semibold text-greige">
        flat photo of a fabric
      </span>{" "}
      swatch. Get back{" "}
      <span className="font-semibold text-greige">
        one catalogue photograph
      </span>{" "}
      — same colour, same weave — styled as a spiral drape. Download when ready.
    </>
  ),
  sizing: (
    <>
      Upload a photo of the garment. AI Studio reads the{" "}
      <span className="font-semibold text-greige">style</span>, builds a{" "}
      <span className="font-semibold text-greige">ghost mannequin</span> with
      measurement lines, and the standard XS–XXL chart.{" "}
      <span className="font-semibold text-greige">Standard sizes only</span> —
      finished-garment measurements, not custom body measurement.
    </>
  ),
};

export function StudioApp() {
  const [tab, setTab] = useState<StudioTabId>("render");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);
  const [usdPkrRate, setUsdPkrRate] = useState(278);
  const [defaultHouseModelId, setDefaultHouseModelId] =
    useState<HouseModelSelection>(RANDOM_HOUSE_MODEL_ID);

  useEffect(() => {
    void getPhotorealSettingsAction()
      .then((data) => {
        if (data.ok && data.preferredHouseModelId) {
          setDefaultHouseModelId(data.preferredHouseModelId);
        }
      })
      .catch(() => undefined);
  }, []);

  const onSessionCost = useCallback((deltaUsd: number) => {
    setSessionCost((s) => s + deltaUsd);
  }, []);

  return (
    <StudioToastProvider>
      <StudioShell
        tab={tab}
        onTabChange={setTab}
        subtitle={SUBTITLES[tab]}
        onOpenSettings={() => setSettingsOpen(true)}
      >
        {tab === "render" && (
          <RenderTab
            defaultHouseModelId={defaultHouseModelId}
            sessionCostPkr={
              sessionCost > 0
                ? usdToPkrAtRate(sessionCost, usdPkrRate)
                : undefined
            }
            usdPkrRate={usdPkrRate}
            onSessionCost={onSessionCost}
          />
        )}
        {tab === "fabric" && <FabricTab />}
        {tab === "sizing" && <SizingTab />}
      </StudioShell>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => setDefaultHouseModelId(s.preferredHouseModelId)}
      />
    </StudioToastProvider>
  );
}
