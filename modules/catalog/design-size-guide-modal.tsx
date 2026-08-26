"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { Measure } from "@/modules/ui";
import type { BodyOrGarment } from "@aks/shared";

import type { DesignSizeChartPublic } from "./resolve-design-size-chart";

type Props = {
  open: boolean;
  onClose: () => void;
  chart: DesignSizeChartPublic | null;
  ghostUrl?: string | null;
  selectedSizeLabel: string | null;
  measurementView: BodyOrGarment;
  onMeasurementViewChange: (view: BodyOrGarment) => void;
  onSelectSize: (sizeLabel: string) => void;
};

function bodyRowLabel(label: string): string {
  return `Fits a ${label.toLowerCase()} of`;
}

export function DesignSizeGuideModal({
  open,
  onClose,
  chart,
  ghostUrl,
  selectedSizeLabel,
  measurementView,
  onMeasurementViewChange,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col border border-greige-deep bg-greige text-ink sm:max-h-[85dvh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-greige-deep px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="font-display text-[26px] font-medium leading-tight"
            >
              Size guide
            </h2>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-ink/65">
              Measured for this exact piece. Choose a column to apply that size.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="border border-greige-deep px-3 py-1.5 text-[12px] uppercase tracking-[0.08em] text-ink"
          >
            Close
          </button>
        </div>

        <div className="border-b border-greige-deep px-5 py-3">
          <div className="inline-flex border border-greige-deep">
            <button
              type="button"
              onClick={() => onMeasurementViewChange("BODY")}
              className={
                measurementView === "BODY"
                  ? "bg-ink px-3 py-2 text-[12px] text-greige"
                  : "px-3 py-2 text-[12px] text-ink"
              }
            >
              Body measurements
            </button>
            <button
              type="button"
              onClick={() => onMeasurementViewChange("GARMENT")}
              className={
                measurementView === "GARMENT"
                  ? "bg-ink px-3 py-2 text-[12px] text-greige"
                  : "px-3 py-2 text-[12px] text-ink"
              }
            >
              Finished garment
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {ghostUrl ? (
            <figure className="mb-6 flex flex-col items-center gap-2 border border-greige-deep bg-milk p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- external sizing image */}
              <img
                src={ghostUrl}
                alt="This design shown on a ghost mannequin"
                className="max-h-[44dvh] w-auto object-contain"
              />
              <figcaption className="text-[11px] uppercase tracking-[0.1em] text-ink/45">
                Measured on the piece · sizes below
              </figcaption>
            </figure>
          ) : null}
          {!chart ? (
            <p className="text-[14px] leading-relaxed text-ink/70">
              No size chart is published for this design yet — message us on
              WhatsApp and we&apos;ll help you find your size.
            </p>
          ) : (
            <div className="space-y-8">
              {chart.notes ? (
                <p className="border border-greige-deep px-3 py-2 text-[13px] leading-relaxed text-ink/70">
                  {chart.notes}
                </p>
              ) : null}

              {chart.components.map((section) => {
                const visibleRows = section.rows.filter(
                  (row) => row.bodyOrGarment === measurementView,
                );
                if (visibleRows.length === 0) return null;

                return (
                  <section key={section.componentKey}>
                    {chart.components.length > 1 ? (
                      <h3 className="mb-3 font-display text-[18px] font-medium">
                        {section.componentName}
                      </h3>
                    ) : null}

                    <div className="overflow-x-auto border border-greige-deep">
                      <table className="w-full min-w-[520px] border-collapse text-[13px]">
                        <thead>
                          <tr className="border-b border-greige-deep bg-greige-deep/30">
                            <th className="px-3 py-2 text-start font-sans text-[11px] uppercase tracking-[0.1em] text-ink/55">
                              Measurement
                            </th>
                            {chart.sizeLabels.map((sizeLabel) => {
                              const active = selectedSizeLabel === sizeLabel;
                              return (
                                <th key={sizeLabel} className="px-1 py-2">
                                  <button
                                    type="button"
                                    onClick={() => onSelectSize(sizeLabel)}
                                    className={
                                      active
                                        ? "w-full border border-ink bg-ink px-2 py-1.5 font-data text-[12px] text-greige"
                                        : "w-full border border-transparent px-2 py-1.5 font-data text-[12px] text-ink hover:border-greige-deep"
                                    }
                                  >
                                    {sizeLabel}
                                    {sizeLabel === chart.baseSizeLabel
                                      ? " · base"
                                      : ""}
                                  </button>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row) => (
                            <tr
                              key={`${section.componentKey}-${row.measurementKey}`}
                              className="border-b border-greige-deep/80 last:border-b-0"
                            >
                              <td className="px-3 py-2 text-ink/80">
                                {measurementView === "BODY"
                                  ? bodyRowLabel(row.label)
                                  : row.label}
                              </td>
                              {chart.sizeLabels.map((sizeLabel) => (
                                <td
                                  key={sizeLabel}
                                  className="px-2 py-2 text-center font-data"
                                >
                                  <Measure
                                    value={row.valuesBySize[sizeLabel]!}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
