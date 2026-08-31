"use client";

import type { OverlayPlacements } from "@/modules/sizing/garment-size-guide";
import { useState } from "react";

import { DesignSizeGuideContent } from "./design-size-guide-content";
import type { DesignSizeChartPublic } from "./resolve-design-size-chart";

type Props = {
  chart: DesignSizeChartPublic | null;
  ghostUrl?: string | null;
  placements?: OverlayPlacements;
  availableSizeLabels: readonly string[];
  selectedSizeLabel: string | null;
  onSelectSize: (sizeLabel: string) => void;
};

export function DesignSizingPanel({
  chart,
  ghostUrl,
  placements,
  availableSizeLabels,
  selectedSizeLabel,
  onSelectSize,
}: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-8 border border-greige-deep">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-start"
        aria-expanded={open}
      >
        <span className="font-display text-[18px] text-ink">Size &amp; fit</span>
        <span className="text-[13px] text-madder" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <div className="size-guide-body border-t border-greige-deep px-4 py-5">
          <DesignSizeGuideContent
            chart={chart}
            ghostUrl={ghostUrl}
            placements={placements}
            availableSizeLabels={availableSizeLabels}
            selectedSizeLabel={selectedSizeLabel}
            onSelectSize={onSelectSize}
          />
        </div>
      ) : null}
    </div>
  );
}
