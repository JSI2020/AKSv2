"use client";

import { useQueryStates } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import type { BodyOrGarment } from "@aks/shared";

import { Money } from "@/modules/ui";

import { DesignColourwayPicker } from "./design-colourway-picker";
import { designDetailParsers } from "./design-detail-search-params";
import { DesignGallery } from "./design-gallery";
import { DesignSizeGuideModal } from "./design-size-guide-modal";
import { DesignSizePicker } from "./design-size-picker";
import { AddToCartButton } from "@/modules/cart/add-to-cart-button";
import { ReflectionPanel } from "@/modules/tryon/reflection-panel";
import type {
  ConfiguratorState,
  DesignDetailPublic,
  GalleryAngle,
  ResolvedImageTriple,
  SizeMode,
} from "./types";
import type { DesignSizeChartPublic } from "./resolve-design-size-chart";
import {
  colourwayUrlValue,
  formatLeadTime,
  resolveColourwayId,
} from "./types";

type Props = {
  design: DesignDetailPublic;
  sizeChart: DesignSizeChartPublic | null;
  imagesByColourway: Record<string, ResolvedImageTriple>;
  initialColourwayParam: string | null;
  initialAngle: GalleryAngle;
  initialSizeMode: SizeMode;
  initialSizeLabel: string | null;
  initialQuantity: number;
  measurementProfileId: string | null;
  leadTimePromise?: string;
};

function leadLine(
  daysOverride: number | null,
  promise?: string,
): string {
  if (daysOverride != null) {
    return `Made when you order · ${daysOverride} days`;
  }
  return promise ?? "Made when you order · 18–24 days";
}

export function DesignConfigurator({
  design,
  sizeChart,
  imagesByColourway,
  initialColourwayParam,
  initialAngle,
  initialSizeMode,
  initialSizeLabel,
  initialQuantity,
  measurementProfileId,
  leadTimePromise,
}: Props) {
  const [urlState, setUrlState] = useQueryStates(designDetailParsers, {
    history: "push",
    shallow: false,
  });

  const initialColourwayId = resolveColourwayId(
    initialColourwayParam,
    design.colourways,
    design.defaultColourwayId,
  );

  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [measurementView, setMeasurementView] =
    useState<BodyOrGarment>("BODY");

  const colourwayId = resolveColourwayId(
    urlState.colourway ?? initialColourwayParam,
    design.colourways,
    initialColourwayId,
  );

  const state: ConfiguratorState = useMemo(
    () => ({
      angle: urlState.angle ?? initialAngle,
      colourwayId,
      sizeMode: urlState.sizeMode ?? initialSizeMode,
      sizeLabel: urlState.sizeLabel ?? initialSizeLabel,
      measurements,
      quantity: urlState.qty ?? initialQuantity,
    }),
    [
      urlState.angle,
      urlState.sizeMode,
      urlState.sizeLabel,
      urlState.qty,
      colourwayId,
      measurements,
      initialAngle,
      initialSizeMode,
      initialSizeLabel,
      initialQuantity,
    ],
  );

  const selectedColourway =
    design.colourways.find((c) => c.id === state.colourwayId) ??
    design.colourways[0]!;

  const displayPriceMinor =
    design.basePriceMinor +
    selectedColourway.priceDeltaMinor +
    (state.sizeMode === "MADE_TO_MEASURE"
      ? design.madeToMeasureSurchargeMinor
      : 0);

  const images =
    imagesByColourway[state.colourwayId] ??
    imagesByColourway[design.defaultColourwayId]!;

  const houseTag = design.tags.find((t) => t.kind === "FREE");
  const silLine =
    design.silhouetteLabel ||
    (houseTag
      ? `${houseTag.value.replace(/_/g, " ").toLowerCase()} · ${design.garmentCategory.name}`
      : design.garmentCategory.name);

  const patchState = useCallback(
    (patch: Partial<ConfiguratorState>) => {
      if (patch.measurements !== undefined) {
        setMeasurements(patch.measurements);
      }

      const urlPatch: Partial<typeof urlState> = {};
      if (patch.angle !== undefined) urlPatch.angle = patch.angle;
      if (patch.colourwayId !== undefined) {
        urlPatch.colourway = colourwayUrlValue(
          patch.colourwayId,
          design.colourways,
        );
      }
      if (patch.sizeMode !== undefined) urlPatch.sizeMode = patch.sizeMode;
      if (patch.sizeLabel !== undefined) urlPatch.sizeLabel = patch.sizeLabel;
      if (patch.quantity !== undefined) urlPatch.qty = patch.quantity;

      if (Object.keys(urlPatch).length > 0) {
        void setUrlState(urlPatch);
      }
    },
    [design.colourways, setUrlState],
  );

  const handleSelectSizeFromGuide = useCallback(
    (sizeLabel: string) => {
      patchState({ sizeMode: "STANDARD", sizeLabel });
      setSizeGuideOpen(false);
    },
    [patchState],
  );

  return (
    <div className="pdp-grid">
      <DesignGallery
        images={images}
        angle={state.angle}
        designName={design.name}
        onAngleChange={(angle) => patchState({ angle })}
      />

      <div className="pdp-info">
        <span className="eyebrow">Made to order</span>
        <h1 className="serif">{design.name}</h1>
        <div className="pdp-sil">{silLine}</div>
        <div className="pdp-price">
          <Money value={displayPriceMinor} />
        </div>
        <div className="pdp-lead">
          {leadLine(design.leadTimeDaysOverride, leadTimePromise)}
        </div>

        {design.description ? (
          <p className="pdp-desc">{design.description}</p>
        ) : null}

        <DesignColourwayPicker
          colourways={design.colourways}
          colourwayId={state.colourwayId}
          onSelect={(id) => patchState({ colourwayId: id })}
        />

        <DesignSizePicker
          designSlug={design.slug}
          sizeMode={state.sizeMode}
          sizeLabel={state.sizeLabel}
          onSizeModeChange={(sizeMode) => patchState({ sizeMode })}
          onSizeLabelChange={(sizeLabel) => patchState({ sizeLabel })}
          onOpenSizeGuide={() => setSizeGuideOpen(true)}
        />

        <DesignSizeGuideModal
          open={sizeGuideOpen}
          onClose={() => setSizeGuideOpen(false)}
          chart={sizeChart}
          selectedSizeLabel={state.sizeLabel}
          measurementView={measurementView}
          onMeasurementViewChange={setMeasurementView}
          onSelectSize={handleSelectSizeFromGuide}
        />

        <AddToCartButton
          design={design}
          colourwayId={state.colourwayId}
          sizeMode={state.sizeMode}
          sizeLabel={state.sizeLabel}
          quantity={state.quantity}
          measurementProfileId={
            state.sizeMode === "MADE_TO_MEASURE" ? measurementProfileId : null
          }
          customizationSelections={{}}
          displayPriceMinor={displayPriceMinor}
          images={images}
        />

        <div className="pdp-detail">
          <div className="drow">
            <span className="k">Fabric</span>
            <span>{selectedColourway.fabricName}</span>
          </div>
          <div className="drow">
            <span className="k">Silhouette</span>
            <span>{design.garmentCategory.name}</span>
          </div>
          <div className="drow">
            <span className="k">Lead time</span>
            <span>{formatLeadTime(design.leadTimeDaysOverride)}</span>
          </div>
          {design.modelDisclosure ? (
            <div className="drow">
              <span className="k">Model</span>
              <span>{design.modelDisclosure}</span>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: "2rem" }}>
          <ReflectionPanel
            designId={design.id}
            designName={design.name}
            colourwayId={state.colourwayId}
            archetypeId={design.archetypeId ?? null}
            colourways={design.colourways.map((c) => ({
              id: c.id,
              name: c.name,
            }))}
            onColourwayChange={(id) => patchState({ colourwayId: id })}
          />
        </div>

        {design.storyCopy ? (
          <p className="pdp-desc" style={{ marginTop: "1.5rem" }}>
            {design.storyCopy}
          </p>
        ) : null}
      </div>
    </div>
  );
}
