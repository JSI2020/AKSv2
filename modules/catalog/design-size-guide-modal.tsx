"use client";

import type { OverlayPlacements } from "@/modules/sizing/garment-size-guide";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { DesignSizeGuideContent } from "./design-size-guide-content";
import type { DesignSizeChartPublic } from "./resolve-design-size-chart";

type Props = {
  open: boolean;
  onClose: () => void;
  chart: DesignSizeChartPublic | null;
  ghostUrl?: string | null;
  placements?: OverlayPlacements;
  availableSizeLabels: readonly string[];
  selectedSizeLabel: string | null;
  onSelectSize: (sizeLabel: string) => void;
};

export function DesignSizeGuideModal({
  open,
  onClose,
  chart,
  ghostUrl,
  placements,
  availableSizeLabels,
  selectedSizeLabel,
  onSelectSize,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div
      className="shop-proto size-guide-scrim"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="size-guide-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="size-guide-head">
          <h2 id={titleId} className="size-guide-title">
            Size &amp; fit
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="size-guide-close"
          >
            Close
          </button>
        </div>

        <div className="size-guide-body">
          <DesignSizeGuideContent
            chart={chart}
            ghostUrl={ghostUrl}
            placements={placements}
            availableSizeLabels={availableSizeLabels}
            selectedSizeLabel={selectedSizeLabel}
            onSelectSize={onSelectSize}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
