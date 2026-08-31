"use client";

import type { OverlayPlacements } from "@/modules/sizing/garment-size-guide";
import { useMemo, useState } from "react";

import { Measure } from "@/modules/ui";
import { GarmentSizingPreview } from "@/modules/sizing/garment-size-guide";

import type { DesignSizeChartPublic } from "./resolve-design-size-chart";

type DisplayUnit = "in" | "cm";

type Props = {
  chart: DesignSizeChartPublic | null;
  ghostUrl?: string | null;
  placements?: OverlayPlacements;
  availableSizeLabels: readonly string[];
  selectedSizeLabel: string | null;
  onSelectSize?: (sizeLabel: string) => void;
};

export function DesignSizeGuideContent({
  chart,
  ghostUrl,
  placements,
  availableSizeLabels,
  selectedSizeLabel,
  onSelectSize,
}: Props) {
  const [unit, setUnit] = useState<DisplayUnit>("in");
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const sizeColumns = useMemo(() => {
    if (!chart) return [...availableSizeLabels];
    const allowed = new Set(availableSizeLabels);
    return chart.sizeLabels.filter((label) => allowed.has(label));
  }, [chart, availableSizeLabels]);

  const hasVisibleRows = useMemo(
    () => chart?.components.some((section) => section.rows.length > 0) ?? false,
    [chart],
  );

  const showOverlay =
    Boolean(ghostUrl && chart?.overlay && chart.overlay.rows.length > 0);

  if (!chart || !hasVisibleRows) {
    if (ghostUrl) {
      return (
        <figure className="size-guide-ghost-only">
          {/* eslint-disable-next-line @next/next/no-img-element -- external sizing asset */}
          <img src={ghostUrl} alt="" className="size-guide-ghost-img" />
        </figure>
      );
    }
    return null;
  }

  return (
    <div className="size-guide-minimal">
      {showOverlay ? (
        <div className="size-guide-visual">
          <GarmentSizingPreview
            imageUrl={ghostUrl!}
            rows={chart.overlay!.rows}
            unit={unit}
            silhouette={chart.overlay!.silhouette}
            highlightKey={highlightKey}
            baseSize={chart.baseSizeLabel}
            theme="shop"
            placements={placements}
          />
        </div>
      ) : ghostUrl ? (
        <figure className="size-guide-ghost-only">
          {/* eslint-disable-next-line @next/next/no-img-element -- external sizing asset */}
          <img src={ghostUrl} alt="" className="size-guide-ghost-img" />
        </figure>
      ) : null}

      <div className="size-guide-unit-toggle">
        {(["in", "cm"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={unit === value}
            onClick={() => setUnit(value)}
            className={unit === value ? "on" : undefined}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="size-guide-sections">
        {chart.components.map((section) => {
          if (section.rows.length === 0) return null;

          return (
            <div key={section.componentKey} className="size-guide-table-wrap">
              <table className="size-guide-table">
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    {sizeColumns.map((sizeLabel) => {
                      const active = selectedSizeLabel === sizeLabel;
                      return (
                        <th key={sizeLabel} scope="col">
                          {onSelectSize ? (
                            <button
                              type="button"
                              onClick={() => onSelectSize(sizeLabel)}
                              className={
                                active ? "size-guide-col on" : "size-guide-col"
                              }
                              aria-pressed={active}
                            >
                              {sizeLabel}
                            </button>
                          ) : (
                            sizeLabel
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => {
                    const highlighted = highlightKey === row.measurementKey;
                    return (
                      <tr
                        key={`${section.componentKey}-${row.measurementKey}`}
                        className={highlighted ? "on" : undefined}
                        onMouseEnter={() => setHighlightKey(row.measurementKey)}
                        onMouseLeave={() => setHighlightKey(null)}
                      >
                        <th scope="row">{row.label}</th>
                        {sizeColumns.map((sizeLabel) => {
                          const value = row.valuesBySize[sizeLabel];
                          const isBase = sizeLabel === chart.baseSizeLabel;
                          return (
                            <td
                              key={sizeLabel}
                              className={isBase ? "base" : undefined}
                            >
                              {value != null ? (
                                <Measure value={value} unit={unit} />
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
