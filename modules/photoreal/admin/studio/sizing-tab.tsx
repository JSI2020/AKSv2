"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, Download, LayoutGrid, Shirt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { STANDARD_SIZES } from "@/modules/dress-sizing/db/enums";
import {
  FIT_LABELS,
  GARMENT_LABELS,
  LENGTH_LABELS,
  POM_LABELS,
} from "@/modules/dress-sizing/ui/labels";
import type { SilhouetteMode } from "@/modules/dress-sizing/core/silhouette";
import { hundredthsToDisplayNumber } from "@/modules/dress-sizing/core/units";
import type { DisplayUnit } from "@/modules/dress-sizing/core/units";
import { CATEGORY_STYLES } from "@/modules/designs/standard-styles";

import {
  studioBuildSizeChartAction,
  studioOverrideStyleAction,
  type StudioChartRow,
} from "../../actions";

import {
  displayGarmentChartRows,
  GarmentSizingPreview,
  pomKeyToMeasurementKey,
} from "@/modules/sizing/garment-size-guide";
import {
  EmptyOutput,
  PanelHead,
  StudioDropzone,
  ThumbRow,
  Workbench,
  studioLabelClass,
  useStudioToast,
} from "./studio-primitives";

type ChartState = {
  styleId: string;
  styleName: string;
  templateKey: string;
  lengthBand: string;
  fitIntent: string;
  confidence: number | null;
  rows: StudioChartRow[];
  ghostUrl: string | null;
  silhouette: SilhouetteMode;
  silhouetteLabel: string;
  /** Set when the photo itself was measured; null = style template only. */
  standardRows: StudioChartRow[];
  measured: {
    captureContext: string;
    anchor: string;
    corrected: number;
    flagged: number;
    detail: Array<{
      pomKey: string;
      measured: number | null;
      prior: number;
      delta: number;
      flagged: boolean;
    }>;
  } | null;
};

const ALL_PRESETS = Object.entries(CATEGORY_STYLES).flatMap(([, styles]) =>
  styles.map((s) => ({
    id: `${s.key}|${s.lengthBand}|${s.fitIntent}`,
    label: s.label,
    key: s.key,
    lengthBand: s.lengthBand,
    fitIntent: s.fitIntent,
  })),
);

export function SizingTab() {
  const toast = useStudioToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<ChartState | null>(null);
  const [unit, setUnit] = useState<DisplayUnit>("cm");
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [overrideId, setOverrideId] = useState("");
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const displayImageUrl = chart?.ghostUrl ?? preview;

  const tableRows = useMemo(
    () =>
      chart
        ? displayGarmentChartRows(chart.rows, chart.silhouette)
        : [],
    [chart],
  );

  const detectedMeta = useMemo(() => {
    if (!chart) return "";
    const parts = [
      FIT_LABELS[chart.fitIntent as keyof typeof FIT_LABELS],
      LENGTH_LABELS[chart.lengthBand as keyof typeof LENGTH_LABELS],
    ].filter(Boolean);
    if (chart.confidence != null) {
      parts.push(`confidence ${Math.round(chart.confidence * 100)}%`);
    }
    return parts.join(" · ");
  }, [chart]);

  const handleUpload = (files: FileList) => {
    const file = files[0];
    if (!file?.type.startsWith("image/")) return;
    setPreview(URL.createObjectURL(file));
    setPhotoFile(file);
    setChart(null);
    setError(null);
    setHighlightKey(null);
  };

  const handleBuild = async () => {
    if (!photoFile) {
      setError("Choose a garment photo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("photo", photoFile);
      const res = await studioBuildSizeChartAction(fd);
      if (!res.ok) throw new Error(res.error);
      setChart(res);
      setHighlightKey(null);
      toast(
        res.ghostUrl
          ? "Ghost mannequin · chart built"
          : "Chart built · ghost unavailable",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build chart.");
    } finally {
      setBusy(false);
    }
  };

  const handleOverride = async () => {
    if (!chart || !overrideId) return;
    const preset = ALL_PRESETS.find((p) => p.id === overrideId);
    if (!preset) return;
    setBusy(true);
    setError(null);
    try {
      const res = await studioOverrideStyleAction({
        styleId: chart.styleId,
        templateKey: preset.key,
        lengthBand: preset.lengthBand,
        fitIntent: preset.fitIntent,
      });
      if (!res.ok) throw new Error(res.error);
      setChart((prev) => ({
        ...res,
        ghostUrl: prev?.ghostUrl ?? null,
      }));
      setStylePickerOpen(false);
      toast("Style updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change style.");
    } finally {
      setBusy(false);
    }
  };

  const tableMatrix = () => {
    if (!chart) return [];
    const head = ["Measure", ...STANDARD_SIZES];
    const rows = tableRows.map((r) => [
      r.label,
      ...STANDARD_SIZES.map((size) => {
        const val = r.values[size];
        if (val == null) return "";
        return String(hundredthsToDisplayNumber(val, unit));
      }),
    ]);
    return [head, ...rows];
  };

  const copyChart = async () => {
    const txt = tableMatrix()
      .map((r) => r.join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast("Chart copied");
    } catch {
      toast("Copy blocked by browser");
    }
  };

  const csvChart = () => {
    const csv = tableMatrix()
      .map((r) => r.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aks-size-chart.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV downloaded");
  };

  const clearAll = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPhotoFile(null);
    setChart(null);
    setError(null);
    setStylePickerOpen(false);
    setHighlightKey(null);
    toast("Cleared");
  };

  return (
    <Workbench
      input={
        <div>
          <PanelHead label="Garment" step="01" />

          <div className="mb-5">
            <span className={studioLabelClass}>Garment photo</span>
            <StudioDropzone
              label="Drop a garment photo"
              sublabel="Front-on, whole piece · PNG, JPG, WEBP"
              disabled={busy}
              onChoose={() => inputRef.current?.click()}
              inputRef={inputRef}
              onFileChange={handleUpload}
              onDrop={handleUpload}
            />
            {preview && (
              <ThumbRow
                assets={[{ localPreview: preview, name: "Garment" }]}
                onRemove={() => {
                  URL.revokeObjectURL(preview);
                  setPreview(null);
                  setPhotoFile(null);
                  setChart(null);
                  setHighlightKey(null);
                }}
              />
            )}
          </div>

          {chart && (
            <div className="mb-5">
              <span className={studioLabelClass}>Detected style</span>
              <div className="flex items-center gap-3 rounded-[2px] border border-indigo-lift bg-indigo px-3 py-3">
                <span className="flex size-9 items-center justify-center rounded-[2px] bg-zari/15 text-zari">
                  <Shirt className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-greige">
                    {GARMENT_LABELS[
                      chart.templateKey as keyof typeof GARMENT_LABELS
                    ] ?? chart.styleName}
                  </p>
                  <p className="text-[11.5px] text-chalk">{detectedMeta}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-[12px] font-semibold text-zari hover:underline"
                  onClick={() => setStylePickerOpen((o) => !o)}
                >
                  Change
                </button>
              </div>
              {stylePickerOpen && (
                <div className="mt-2 space-y-2 rounded-[2px] border border-indigo-lift p-3">
                  <select
                    className="w-full rounded-[2px] border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
                    value={overrideId}
                    onChange={(e) => setOverrideId(e.target.value)}
                  >
                    <option value="">Pick a style…</option>
                    {ALL_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!overrideId || busy}
                    className="rounded-[2px] border-indigo-lift text-[12px] text-greige"
                    onClick={() => void handleOverride()}
                  >
                    Apply style
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mb-5">
            <span className={studioLabelClass}>Size range</span>
            <div className="flex flex-wrap gap-1.5">
              {STANDARD_SIZES.map((s) => (
                <span
                  key={s}
                  className="rounded-[2px] border border-indigo-lift px-2.5 py-1 font-mono text-[12px] text-chalk"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-chalk">
              Fixed brand range. Grades are specific to the detected style.
            </p>
          </div>

          <div className="mb-5">
            <span className={studioLabelClass}>Units</span>
            <div className="inline-flex overflow-hidden rounded-[2px] border border-indigo-lift">
              {(["cm", "in"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={unit === u}
                  onClick={() => setUnit(u)}
                  className={cn(
                    "px-3.5 py-1.5 font-mono text-[12px]",
                    unit === u
                      ? "bg-zari text-indigo"
                      : "bg-indigo text-chalk hover:text-greige",
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="mb-4 text-[13px] text-madder" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-5 border-t border-indigo-lift pt-5">
            <Button
              type="button"
              disabled={busy || !photoFile}
              className="rounded-[2px] border border-zari bg-zari text-[13.5px] text-indigo hover:bg-zari/90"
              onClick={() => void handleBuild()}
            >
              <LayoutGrid className="size-4" />
              {busy ? "Building…" : "Build size chart"}
            </Button>
            <button
              type="button"
              className="text-[13px] text-chalk hover:text-greige"
              disabled={busy}
              onClick={clearAll}
            >
              Clear
            </button>
          </div>
        </div>
      }
      output={
        <div className="flex flex-col gap-6">
          <div>
            <PanelHead label="Ghost mannequin" step="02" />
            {!chart || !displayImageUrl ? (
              <EmptyOutput
                title="Ghost mannequin appears here"
                subtitle="Upload a garment and build the chart. We generate an invisible-mannequin shot and draw finished-garment measurements on it."
              />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="border border-indigo-lift px-3 py-2 text-[12px] text-chalk">
                  {chart.silhouetteLabel}.{" "}
                  {chart.measured ? (
                    <>
                      <span className="text-zari">Measured from the photo</span>{" "}
                      ({chart.measured.captureContext.replace("_", " ")}, scaled
                      on{" "}
                      {chart.measured.anchor === "person_height"
                        ? "model height"
                        : "garment length"}
                      ) — {chart.measured.corrected} measurement
                      {chart.measured.corrected === 1 ? "" : "s"} corrected
                      against the house template
                      {chart.measured.flagged > 0
                        ? `, ${chart.measured.flagged} flagged for review`
                        : ""}
                      .
                    </>
                  ) : (
                    <>
                      Computed from the house body grid + style template — the
                      photo could not be measured.
                    </>
                  )}{" "}
                  Edit under Settings · Size chart tool before publishing.
                </p>
                {chart.measured?.detail.length ? (
                  <details className="border border-indigo-lift px-3 py-2 text-[12px] text-chalk">
                    <summary className="cursor-pointer text-greige">
                      What the photo measured, row by row
                    </summary>
                    <table className="mt-2 w-full border-collapse text-[11.5px]">
                      <thead>
                        <tr className="text-chalk">
                          <th className="py-1 text-start font-normal">Row</th>
                          <th className="py-1 text-end font-normal">Photo</th>
                          <th className="py-1 text-end font-normal">Template</th>
                          <th className="py-1 text-end font-normal">Applied</th>
                        </tr>
                      </thead>
                      <tbody className="font-data">
                        {chart.measured.detail.map((d) => (
                          <tr key={d.pomKey} className="border-t border-indigo-lift/50">
                            <td className="py-1 text-greige">
                              {POM_LABELS[d.pomKey as keyof typeof POM_LABELS] ?? d.pomKey}
                            </td>
                            <td className="py-1 text-end">
                              {d.measured == null ? "not measured" : (d.measured / 100).toFixed(2)}
                            </td>
                            <td className="py-1 text-end">{(d.prior / 100).toFixed(2)}</td>
                            <td className="py-1 text-end">
                              {d.flagged ? (
                                <span className="text-madder">rejected · 3σ</span>
                              ) : d.delta === 0 ? (
                                "—"
                              ) : (
                                <span className="text-zari">
                                  {d.delta > 0 ? "+" : ""}
                                  {(d.delta / 100).toFixed(2)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ) : null}
                <GarmentSizingPreview
                  imageUrl={displayImageUrl}
                  rows={chart.rows}
                  unit={unit}
                  silhouette={chart.silhouette}
                  highlightKey={highlightKey}
                />
                {!chart.ghostUrl && preview ? (
                  <p className="text-[11.5px] text-chalk">
                    Ghost generation unavailable — overlay shown on your upload.
                    Check FAL_KEY in settings if you expected a ghost shot.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {tableRows.map((row) => {
                    const mk = pomKeyToMeasurementKey(row.pomKey);
                    if (!mk) return null;
                    const active = highlightKey === mk;
                    return (
                      <button
                        key={row.pomKey}
                        type="button"
                        onClick={() =>
                          setHighlightKey((k) => (k === mk ? null : mk))
                        }
                        className={cn(
                          "rounded-[2px] border px-2 py-1 font-data text-[11px]",
                          active
                            ? "border-zari text-zari"
                            : "border-indigo-lift text-chalk hover:text-greige",
                        )}
                      >
                        {row.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <PanelHead label="Size chart" step="03" />
            {!chart ? (
              <EmptyOutput
                title="Size chart appears here"
                subtitle="Finished-garment XS–XXL measurements for the detected style, in the units you choose."
              />
            ) : (
              <div className="overflow-hidden rounded-[2px] border border-indigo-lift bg-indigo">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-lift px-4 py-3">
                  <div>
                    <p className="font-display text-lg text-greige">
                      {chart.styleName}
                    </p>
                    <p className="text-[11.5px] text-chalk">
                      Finished-garment · {chart.silhouetteLabel} · {unit}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void copyChart()}
                      className="inline-flex items-center gap-1.5 rounded-[2px] border border-indigo-lift px-2.5 py-1.5 text-[11.5px] font-semibold text-chalk hover:bg-indigo-lift"
                    >
                      <Copy className="size-3.5" />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={csvChart}
                      className="inline-flex items-center gap-1.5 rounded-[2px] border border-indigo-lift px-2.5 py-1.5 text-[11.5px] font-semibold text-chalk hover:bg-indigo-lift"
                    >
                      <Download className="size-3.5" />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-mono text-[13px]">
                    <thead>
                      <tr className="border-b border-indigo-lift">
                        <th className="p-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-chalk">
                          Measure
                        </th>
                        {STANDARD_SIZES.map((s) => (
                          <th
                            key={s}
                            className={cn(
                              "p-2.5 text-end text-[11px] font-semibold uppercase tracking-wide",
                              s === "M" ? "text-zari" : "text-chalk",
                            )}
                          >
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => {
                        const mk = pomKeyToMeasurementKey(row.pomKey);
                        const highlighted = mk != null && highlightKey === mk;
                        return (
                          <tr
                            key={row.pomKey}
                            className={cn(
                              "border-b border-indigo-lift last:border-b-0",
                              highlighted
                                ? "bg-zari/15"
                                : "hover:bg-indigo-lift/30",
                            )}
                            onMouseEnter={() => {
                              if (mk) setHighlightKey(mk);
                            }}
                            onMouseLeave={() => setHighlightKey(null)}
                          >
                            <td className="p-2.5 text-start font-sans text-[13px] text-chalk">
                              {row.label}
                            </td>
                            {STANDARD_SIZES.map((size) => {
                              const val = row.values[size];
                              return (
                                <td
                                  key={size}
                                  className={cn(
                                    "p-2.5 text-end",
                                    size === "M" && "bg-zari/10",
                                  )}
                                >
                                  {val != null
                                    ? hundredthsToDisplayNumber(val, unit)
                                    : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <details className="border-t border-indigo-lift px-4 py-3">
                  <summary className="cursor-pointer text-[12px] text-greige">
                    House standard for {GARMENT_LABELS[
                      chart.templateKey as keyof typeof GARMENT_LABELS
                    ] ?? chart.templateKey}{" "}
                    — and how this piece differs
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse font-mono text-[12px]">
                      <thead>
                        <tr className="border-b border-indigo-lift">
                          <th className="p-2 text-start text-[10.5px] font-semibold uppercase tracking-wide text-chalk">
                            Measure
                          </th>
                          {STANDARD_SIZES.map((sz) => (
                            <th
                              key={sz}
                              className="p-2 text-end text-[10.5px] font-semibold uppercase tracking-wide text-chalk"
                            >
                              {sz}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayGarmentChartRows(
                          chart.standardRows,
                          chart.silhouette,
                        ).map((row) => {
                          const thisPiece = tableRows.find(
                            (r) => r.pomKey === row.pomKey,
                          );
                          return (
                            <tr
                              key={row.pomKey}
                              className="border-b border-indigo-lift last:border-b-0"
                            >
                              <td className="p-2 text-start font-sans text-chalk">
                                {row.label}
                              </td>
                              {STANDARD_SIZES.map((size) => {
                                const std = row.values[size];
                                const mine = thisPiece?.values[size];
                                const diff =
                                  std != null && mine != null ? mine - std : null;
                                return (
                                  <td key={size} className="p-2 text-end">
                                    <span className="text-chalk">
                                      {std != null
                                        ? hundredthsToDisplayNumber(std, unit)
                                        : "—"}
                                    </span>
                                    {diff != null && diff !== 0 ? (
                                      <span className="ms-1 text-zari">
                                        ({diff > 0 ? "+" : ""}
                                        {hundredthsToDisplayNumber(diff, unit)})
                                      </span>
                                    ) : null}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11.5px] text-chalk">
                    Grey is the house standard for this garment type; gold in
                    brackets is how far this piece departs from it.
                  </p>
                </details>
                <p className="border-t border-indigo-lift bg-indigo px-4 py-3 text-[11.5px] text-chalk">
                  Girths follow the detected silhouette — column cuts keep one
                  body block circumference; hem sweep is never narrower than
                  that block. Hover a row to locate it on the schematic overlay.
                </p>
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
