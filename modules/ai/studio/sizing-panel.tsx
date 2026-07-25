"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SizeChartEditor } from "@/modules/sizing/size-chart-editor";
import { formatMeasure } from "@/modules/ui";

import {
  applySizing,
  skipSizing,
  type SizingPageData,
} from "./sizing-actions";
import { computeOverlayLines } from "./sizing/overlay-math";
import { SizingOverlay } from "./sizing-overlay";

export function SizingPanel({ data: initial }: { data: SizingPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>("LENGTH");

  const refreshOverlay = useCallback(
    (valuesByKey: Record<string, number>) => {
      const lines = computeOverlayLines({
        imageHeightPx: data.imageHeightPx,
        modelPixelHeight: data.modelPixelHeight,
        archetypeHeightInches: data.archetypeHeightInches,
        anchorYBpByKey: data.anchorYBpByKey,
        valuesByKey,
        formatValue: (v) => formatMeasure(v, "in"),
      });
      setData((prev) => ({ ...prev, overlayLines: lines }));
    },
    [
      data.anchorYBpByKey,
      data.archetypeHeightInches,
      data.imageHeightPx,
      data.modelPixelHeight,
    ],
  );

  const detectionLabel = useMemo(() => {
    switch (data.modelHeightDetection) {
      case "sharp_bbox":
        return "Detected from render bounds";
      case "stored":
        return "Stored calibration";
      default:
        return "Fallback 88% frame height";
    }
  }, [data.modelHeightDetection]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
              Calibrated overlay · {detectionLabel}
            </p>
            <p className="font-data text-[11px] text-chalk">
              Base {data.baseSizeLabel} · preview only — no regeneration
            </p>
          </div>
          <SizingOverlay
            heroUrl={data.heroReadUrl}
            imageWidthPx={data.imageWidthPx}
            imageHeightPx={data.imageHeightPx}
            lines={data.overlayLines}
            highlightKey={highlightKey}
          />
        </div>

        <div className="flex flex-col gap-4">
          <p className="border border-indigo-lift px-3 py-2 text-[13px] text-greige">
            Category standard chart already applies. Open this only to deviate —
            e.g. make this 3″ shorter. Edits move the chalk lines instantly at
            zero cost.
          </p>
          <SizeChartEditor
            block={data.block}
            designId={data.designId}
            readOnly={data.readOnly}
            onBlockForked={() => {
              router.refresh();
            }}
            onGridChange={refreshOverlay}
          />
        </div>
      </div>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-indigo-lift pt-4">
        {!data.readOnly ? (
          <>
            <button
              type="button"
              disabled={pending}
              className="border border-indigo-lift px-4 py-2 text-[13px] text-greige disabled:opacity-50"
              onClick={() => run(async () => skipSizing(data.designId))}
            >
              Skip — use standard chart
            </button>
            <button
              type="button"
              disabled={pending}
              className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
              onClick={() => run(async () => applySizing(data.designId))}
            >
              Apply sizing
            </button>
            <p className="text-[12px] text-chalk">
              Apply writes the chart and triggers one hero regeneration (~$0.08).
            </p>
          </>
        ) : (
          <p className="text-[13px] text-chalk">Sizing locked for this design.</p>
        )}

        <a
          href={`/admin/studio/${data.designId}`}
          className="ms-auto border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
        >
          ← Hero
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.block.rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() =>
              setHighlightKey((k) =>
                k === row.measurementKey ? null : row.measurementKey,
              )
            }
            className={`border px-2 py-1 font-data text-[11px] ${
              highlightKey === row.measurementKey
                ? "border-zari text-zari"
                : "border-indigo-lift text-chalk"
            }`}
          >
            {row.measurementKey}
          </button>
        ))}
      </div>
    </div>
  );
}
