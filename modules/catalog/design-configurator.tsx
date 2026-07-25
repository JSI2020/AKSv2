"use client";

import { useQueryStates } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import type { BodyOrGarment } from "@aks/shared";

import { Link } from "@/i18n/routing";
import { Money } from "@/modules/ui";

import { DesignColourwayPicker } from "./design-colourway-picker";
import { designDetailParsers } from "./design-detail-search-params";
import { DesignGallery } from "./design-gallery";
import { DesignSizeGuideModal } from "./design-size-guide-modal";
import { DesignSizePicker } from "./design-size-picker";
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
};

export function DesignConfigurator({
  design,
  sizeChart,
  imagesByColourway,
  initialColourwayParam,
  initialAngle,
  initialSizeMode,
  initialSizeLabel,
  initialQuantity,
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
    design.basePriceMinor + selectedColourway.priceDeltaMinor;

  const images =
    imagesByColourway[state.colourwayId] ??
    imagesByColourway[design.defaultColourwayId]!;

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
    <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
      <DesignGallery
        images={images}
        angle={state.angle}
        designName={design.name}
        onAngleChange={(angle) => patchState({ angle })}
      />

      <div>
        <p className="mb-3.5 text-[12px] uppercase tracking-[0.1em] text-madder">
          {design.garmentCategory.name}
        </p>
        <h1 className="mb-3.5 font-display text-[38px] font-medium leading-tight">
          {design.name}
        </h1>
        <Money value={displayPriceMinor} className="mb-6 block text-[22px]" />

        {design.description ? (
          <p className="mb-7 text-[15px] leading-[1.7] text-ink/75">
            {design.description}
          </p>
        ) : null}

        <DesignColourwayPicker
          colourways={design.colourways}
          colourwayId={state.colourwayId}
          onSelect={(id) => patchState({ colourwayId: id })}
        />

        <div className="my-7 border-y border-greige-deep py-5">
          <DesignSizePicker
            designSlug={design.slug}
            sizeMode={state.sizeMode}
            sizeLabel={state.sizeLabel}
            onSizeModeChange={(sizeMode) => patchState({ sizeMode })}
            onSizeLabelChange={(sizeLabel) => patchState({ sizeLabel })}
            onOpenSizeGuide={() => setSizeGuideOpen(true)}
          />
        </div>

        <DesignSizeGuideModal
          open={sizeGuideOpen}
          onClose={() => setSizeGuideOpen(false)}
          chart={sizeChart}
          selectedSizeLabel={state.sizeLabel}
          measurementView={measurementView}
          onMeasurementViewChange={setMeasurementView}
          onSelectSize={handleSelectSizeFromGuide}
        />

        <dl className="mb-7 space-y-3 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink/55">Fabric</dt>
            <dd className="text-end">
              {selectedColourway.fabricName}
              {" · "}
              <Link
                href={`/fabrics?fabric=${selectedColourway.fabricId}`}
                className="border-b border-ink/30 text-ink"
              >
                Fabric story
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/55">Lead time</dt>
            <dd className="text-end">
              {formatLeadTime(design.leadTimeDaysOverride)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/55">Colour</dt>
            <dd className="text-end">{selectedColourway.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/55">Quantity</dt>
            <dd className="text-end">
              <input
                type="number"
                min={1}
                max={99}
                value={state.quantity}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                  patchState({ quantity: n });
                }}
                className="w-16 border border-greige-deep bg-greige px-2 py-1 text-end text-[14px]"
              />
            </dd>
          </div>
        </dl>

        {design.modelDisclosure ? (
          <p className="mb-7 text-[13px] leading-relaxed text-ink/60">
            {design.modelDisclosure}
          </p>
        ) : null}

        {design.storyCopy ? (
          <p className="text-[14px] leading-relaxed text-ink/65">
            {design.storyCopy}
          </p>
        ) : null}
      </div>
    </div>
  );
}
