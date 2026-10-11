"use client";

import { useQueryStates } from "nuqs";
import { normalizeDashes } from "@/modules/content/accent-text";
import { useCallback, useMemo, useState } from "react";

import { Money } from "@/modules/ui";

import { DesignColourwayPicker } from "./design-colourway-picker";
import { designDetailParsers } from "./design-detail-search-params";
import { DesignGallery } from "./design-gallery";
import { DesignSizeGuideModal } from "./design-size-guide-modal";
import { DesignSizePicker } from "./design-size-picker";
import "./size-guide.css";
import { AddToCartButton } from "@/modules/cart/add-to-cart-button";
import {
  resolveShadePriceMinor,
  resolveShadeCompareAtMinor,
  resolveShadeSizeLabels,
} from "@/modules/designs/shade-utils";
import { resolveDisplayPrice } from "./pricing";
import type {
  ConfiguratorState,
  DesignDetailPublic,
  GalleryAngle,
  ResolvedGalleryImages,
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
  imagesByColourway: Record<string, ResolvedGalleryImages>;
  initialColourwayParam: string | null;
  initialAngle: GalleryAngle;
  initialSizeMode: SizeMode;
  initialSizeLabel: string | null;
  initialQuantity: number;
  leadTimePromise?: string;
  whatsappUrl?: string;
};

function leadLine(
  daysOverride: number | null,
  promise?: string,
): string {
  if (daysOverride != null && daysOverride > 0) {
    return formatLeadTime(daysOverride);
  }
  if (promise?.trim()) return promise.trim();
  return formatLeadTime(null);
}

/**
 * Replaces size + bag while a design is Coming soon: the piece is on show,
 * the shopper can ask to be told when it's ready.
 */
function ComingSoonPanel({
  sizes,
  designName,
  whatsappUrl,
}: {
  sizes: string[];
  designName: string;
  whatsappUrl?: string;
}) {
  const notifyUrl = whatsappUrl
    ? withWhatsAppText(
        whatsappUrl,
        `Hello AKS, please let me know when ${designName} is available.`,
      )
    : null;
  return (
    <div className="pdp-soon" role="status">
      <span className="pdp-soon-mark">Coming soon</span>
      <p className="pdp-soon-text">
        This piece is still being finished, so it can&apos;t be ordered yet.
        {sizes.length > 0 ? ` It will come in ${sizes.join(", ")}.` : ""}
      </p>
      {notifyUrl ? (
        <a
          className="addcart pdp-soon-cta"
          href={notifyUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Tell me when it&apos;s ready
        </a>
      ) : null}
    </div>
  );
}

/** Adds a prefilled message to a wa.me / api.whatsapp.com link. */
function withWhatsAppText(url: string, text: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("text")) u.searchParams.set("text", text);
    return u.toString();
  } catch {
    return url;
  }
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
  leadTimePromise,
  whatsappUrl,
}: Props) {
  const [urlState, setUrlState] = useQueryStates(designDetailParsers, {
    history: "push",
    shallow: false,
  });

  // Without an explicit shade in the URL, open on the default shade only if it
  // can be bought — otherwise the first shade with stock, so the page never
  // lands on a dead end when another colour is available.
  const shadeInStock = (cwId: string) => {
    const cw = design.colourways.find((c) => c.id === cwId);
    if (!cw) return false;
    const stock = design.rtwAvailability[cwId] ?? {};
    return resolveShadeSizeLabels(cw, design).some(
      (label) => (stock[label] ?? 0) > 0,
    );
  };
  const fallbackColourwayId =
    design.comingSoon || shadeInStock(design.defaultColourwayId)
    ? design.defaultColourwayId
    : (design.colourways.find((c) => shadeInStock(c.id))?.id ??
      design.defaultColourwayId);
  const comingSoon = design.comingSoon;
  const designSoldOut =
    !comingSoon && !design.colourways.some((c) => shadeInStock(c.id));

  const initialColourwayId = resolveColourwayId(
    initialColourwayParam,
    design.colourways,
    fallbackColourwayId,
  );

  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const colourwayId = resolveColourwayId(
    urlState.colourway ?? initialColourwayParam,
    design.colourways,
    initialColourwayId,
  );

  const state: ConfiguratorState = useMemo(
    () => ({
      angle: urlState.angle ?? initialAngle,
      colourwayId,
      sizeMode: "STANDARD",
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

  const shadeSizeLabels = useMemo(
    () => resolveShadeSizeLabels(selectedColourway, design),
    [selectedColourway, design],
  );

  const availabilityBySize = useMemo(() => {
    const byColourway = design.rtwAvailability[state.colourwayId] ?? {};
    const map: Record<string, number> = {};
    for (const label of shadeSizeLabels) {
      map[label] = byColourway[label] ?? 0;
    }
    return map;
  }, [shadeSizeLabels, design.rtwAvailability, state.colourwayId]);

  const colourwaySoldOut = useMemo(
    () =>
      !comingSoon &&
      shadeSizeLabels.length > 0 &&
      shadeSizeLabels.every((label) => (availabilityBySize[label] ?? 0) <= 0),
    [availabilityBySize, shadeSizeLabels, comingSoon],
  );

  const retailBaseMinor = resolveShadePriceMinor(selectedColourway, design);

  const displayPrice = useMemo(
    () =>
      resolveDisplayPrice({
        basePriceMinor: retailBaseMinor,
        compareAtPriceMinor:
          resolveShadeCompareAtMinor(selectedColourway, design) ??
          design.compareAtPriceMinor,
        compareAtStartsAt: design.compareAtStartsAt,
        compareAtEndsAt: design.compareAtEndsAt,
      }),
    [design, retailBaseMinor, selectedColourway.compareAtPriceMinor],
  );

  // resolveShadePriceMinor already includes priceDelta when shade has no own base.
  // Do not add priceDelta again — that double-counted list price vs cart.
  const displayPriceMinor = displayPrice.priceMinor;

  const selectedAvailable =
    state.sizeLabel != null ? (availabilityBySize[state.sizeLabel] ?? 0) : 0;

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

  const stickyBar = useMemo(
    () => ({
      onChooseSize: () => {
        const head = document.getElementById("pdp-size-head");
        head?.scrollIntoView({ behavior: "smooth", block: "center" });
        const firstOpen = document.querySelector<HTMLButtonElement>(
          ".std button:not(:disabled)",
        );
        firstOpen?.focus({ preventScroll: true });
      },
    }),
    [],
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
        categoryKey={design.garmentCategory.key}
        onAngleChange={(angle) => patchState({ angle })}
      />

      <div className="pdp-info">
        <span className="eyebrow">
          {comingSoon ? "Coming soon" : "Ready to wear"}
        </span>
        <h1 className="serif">{design.name}</h1>
        {design.subtitle ? (
          <p className="pdp-sub">{design.subtitle}</p>
        ) : null}
        <div className="pdp-sil">{silLine}</div>
        <div className="pdp-price">
          <Money value={displayPriceMinor} />
          {displayPrice.compareAtMinor != null ? (
            <span className="pdp-compare">
              <Money value={displayPrice.compareAtMinor + selectedColourway.priceDeltaMinor} />
            </span>
          ) : null}
        </div>
        <div className="pdp-lead">
          {comingSoon
            ? design.comingSoonNote?.trim() || "Coming soon · not yet available to order"
            : leadLine(design.leadTimeDaysOverride, leadTimePromise)}
        </div>

        {design.description ? (
          <p className="pdp-desc">{normalizeDashes(design.description)}</p>
        ) : null}

        <DesignColourwayPicker
          colourways={design.colourways}
          colourwayId={state.colourwayId}
          isSoldOut={(id) =>
            !comingSoon && !designSoldOut && !shadeInStock(id)
          }
          onSelect={(id) => {
            // Keep the chosen size when the new shade has it in stock.
            const keepSize =
              state.sizeLabel != null &&
              (design.rtwAvailability[id]?.[state.sizeLabel] ?? 0) > 0;
            patchState(
              keepSize
                ? { colourwayId: id }
                : { colourwayId: id, sizeLabel: null },
            );
          }}
        />

        {comingSoon ? (
          <ComingSoonPanel
            sizes={shadeSizeLabels}
            designName={design.name}
            whatsappUrl={whatsappUrl}
          />
        ) : (
          <>
        <DesignSizePicker
          sizeMode={state.sizeMode}
          sizeLabel={state.sizeLabel}
          sizes={shadeSizeLabels}
          availabilityBySize={availabilityBySize}
          onSizeModeChange={(sizeMode) => patchState({ sizeMode })}
          onSizeLabelChange={(sizeLabel) => patchState({ sizeLabel })}
          onOpenSizeGuide={() => setSizeGuideOpen(true)}
        />

        {designSoldOut ? (
          <p className="pdp-soldout" role="status">
            Sold out in every size for now. New pieces are cut in small runs
            {whatsappUrl ? (
              <>
                {" — "}
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  message us on WhatsApp
                </a>{" "}
                to hear when it&apos;s back.
              </>
            ) : (
              "; check back soon."
            )}
          </p>
        ) : colourwaySoldOut ? (
          <p className="pdp-soldout" role="status">
            {selectedColourway.name} is sold out. Pick another shade above.
          </p>
        ) : null}

        <AddToCartButton
          design={design}
          colourwayId={state.colourwayId}
          sizeMode="STANDARD"
          sizeLabel={state.sizeLabel}
          quantity={state.quantity}
          availableUnits={selectedAvailable}
          customizationSelections={{}}
          displayPriceMinor={displayPriceMinor}
          images={images}
          soldOut={colourwaySoldOut}
          stickyBar={stickyBar}
        />
          </>
        )}

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
            <span className="k">{comingSoon ? "Availability" : "Lead time"}</span>
            <span>
              {comingSoon
                ? design.comingSoonNote?.trim() || "Coming soon"
                : leadLine(design.leadTimeDaysOverride, leadTimePromise)}
            </span>
          </div>
          {design.modelDisclosure ? (
            <div className="drow">
              <span className="k">Model</span>
              <span>{design.modelDisclosure}</span>
            </div>
          ) : null}
        </div>

        <DesignSizeGuideModal
          open={sizeGuideOpen}
          onClose={() => setSizeGuideOpen(false)}
          chart={sizeChart}
          ghostUrl={design.sizingGhostUrl}
          placements={design.sizingOverlay ?? undefined}
          availableSizeLabels={shadeSizeLabels}
          selectedSizeLabel={state.sizeLabel}
          onSelectSize={handleSelectSizeFromGuide}
          designName={design.name}
        />

        {design.storyCopy ? (
          <p className="pdp-desc" style={{ marginTop: "1.5rem" }}>
            {design.storyCopy}
          </p>
        ) : null}
      </div>
    </div>
  );
}
