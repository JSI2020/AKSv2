"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  applyStandardStyle,
  recognizeDesignSizing,
} from "./recognize-sizing-action";
import {
  groupedStylePresets,
  stylePresetValue,
  stylesForCategory,
} from "./standard-styles";
import {
  MeasurementReport,
  type MeasurementReportData,
} from "@/modules/sizing/measurement-report";

import {
  DEFAULT_SIZE_BLOCK_SEEDS,
  MEASUREMENT_KEY_DEFS,
  STANDARD_SIZE_LABELS,
} from "@aks/shared";
import { Measure, formatMeasure, parseMeasureInput } from "@/modules/ui";
import {
  editBaseCell,
  resolveChart,
  type SizeBlockRowInput,
} from "@/modules/sizing/engine";
import {
  getSizeBlock,
  type SizeBlockDetail,
} from "@/modules/sizing/block-actions";
import {
  findDesignForkBlockId,
  revertSizeBlockFork,
  updateDesignPieceBaseSizes,
} from "@/modules/sizing/fork-actions";
import {
  blockGridToGarmentChartRows,
  displayGarmentChartRows,
  GarmentSizingPreview,
  inferSilhouetteFromChartRows,
  measurementKeyToPomKey,
} from "@/modules/sizing/garment-size-guide";

import type { DesignDetail } from "./actions";

type FormOptions = {
  categories: { id: string; key: string; name: string }[];
  blocks: { id: string; name: string; categoryId: string }[];
  profiles: { id: string; name: string; categoryId: string }[];
};

const MEASURE_LABEL = new Map(
  MEASUREMENT_KEY_DEFS.map((d) => [d.key, d.label] as const),
);

/** Pieces come only from Details — never every category in the house. */
function componentKeysOf(detail: DesignDetail): string[] {
  const fromDesign = (detail.design.components ?? []).filter(Boolean);
  if (fromDesign.length > 0) return fromDesign;
  return detail.categoryKey ? [detail.categoryKey] : [];
}

function titleCasePiece(key: string) {
  const lower = key.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

type RowState = {
  id: string;
  measurementKey: string;
  baseValue: number;
  gradeIncrement: number;
  gradeOverrides: Record<string, number>;
};

export function DesignSizingTab({
  detail,
  options,
  pending,
  onSave,
}: {
  detail: DesignDetail;
  options: FormOptions;
  pending: boolean;
  onSave: (fd: FormData) => void;
}) {
  const d = detail.design;
  const components = componentKeysOf(detail);
  // Fit profiles are preserved on save but no longer edited from this tab.
  const [fitProfiles] = useState<Record<string, string>>(() => ({
    ...(d.fitProfileIds ?? {}),
  }));
  const [pieceSizeBlocks, setPieceSizeBlocks] = useState<
    Record<string, string>
  >(() => ({ ...(d.pieceSizeBlocks ?? {}) }));
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    const initial = d.availableSizeLabels?.length
      ? [...d.availableSizeLabels]
      : [...STANDARD_SIZE_LABELS];
    if (!initial.includes("M")) initial.push("M");
    return [...STANDARD_SIZE_LABELS].filter((s) => initial.includes(s));
  });

  const defaultBlockIdByCategory = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of options.categories) {
      const block = options.blocks.find((b) => b.categoryId === c.id);
      if (block) m.set(c.key, block.id);
    }
    return m;
  }, [options.categories, options.blocks]);

  function toggleSize(label: string) {
    setSelectedSizes((prev) => {
      if (label === "M" && prev.includes("M")) return prev;
      if (prev.includes(label)) {
        return prev.filter((s) => s !== label);
      }
      return [...STANDARD_SIZE_LABELS].filter(
        (s) => s === label || prev.includes(s),
      );
    });
  }

  function resolveBlockId(pieceKey: string): string | null {
    return (
      pieceSizeBlocks[pieceKey] ??
      defaultBlockIdByCategory.get(pieceKey) ??
      null
    );
  }

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("id", d.id);
        const primary = components[0];
        const primaryBlock =
          (primary ? resolveBlockId(primary) : null) ?? d.sizeBlockId ?? "";
        fd.set("sizeBlockId", primaryBlock);
        fd.set("pieceSizeBlocksJson", JSON.stringify(pieceSizeBlocks));
        fd.set("fitProfilesJson", JSON.stringify(fitProfiles));
        fd.set("availableSizeLabelsJson", JSON.stringify(selectedSizes));
        fd.set("madeToMeasureOffered", "false");
        onSave(fd);
      }}
    >
      <section className="mb-4 border border-ink/12 bg-milk px-5 py-5">
        <h3 className="mb-4 font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Available sizes
        </h3>
        <div className="mb-2 flex flex-wrap gap-2">
          {STANDARD_SIZE_LABELS.map((label) => {
            const on = selectedSizes.includes(label);
            const lockedBase = label === "M" && on;
            return (
              <button
                key={label}
                type="button"
                title={
                  lockedBase
                    ? "M is the base size — always offered"
                    : undefined
                }
                onClick={() => toggleSize(label)}
                className={
                  on
                    ? "flex size-11 items-center justify-center border border-ink bg-ink font-data text-[12.5px] text-milk"
                    : "flex size-11 items-center justify-center border border-ink/12 font-data text-[12.5px] text-ink/55 hover:border-ink"
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[12px] text-ink/55">
          Only sizes selected here appear on the storefront — and as columns in
          the size guide below.
        </p>
      </section>

      {components.length === 0 ? (
        <p className="mb-4 text-[13px] text-ink/55">
          Pick pieces on the Details tab first — each piece gets its own size
          guide here.
        </p>
      ) : null}

      {components.map((comp) => {
        const blockId = resolveBlockId(comp);
        const defaultId = defaultBlockIdByCategory.get(comp) ?? null;

        return (
          <PieceSizeGuide
            key={comp}
            designId={d.id}
            pieceKey={comp}
            blockId={blockId}
            defaultBlockId={defaultId}
            availableSizes={selectedSizes}
            initialGhostUrl={d.sizingGhostUrl ?? null}
            onForked={(forkId) => {
              setPieceSizeBlocks((prev) => ({ ...prev, [comp]: forkId }));
            }}
            onReverted={() => {
              setPieceSizeBlocks((prev) => {
                const next = { ...prev };
                delete next[comp];
                return next;
              });
            }}
          />
        );
      })}

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
      >
        Save · continue to Costing
      </button>
    </form>
  );
}

function PieceSizeGuide({
  designId,
  pieceKey,
  blockId,
  defaultBlockId,
  availableSizes,
  initialGhostUrl,
  onForked,
  onReverted,
}: {
  designId: string;
  pieceKey: string;
  blockId: string | null;
  defaultBlockId: string | null;
  availableSizes: string[];
  initialGhostUrl: string | null;
  onForked: (forkId: string) => void;
  onReverted: () => void;
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [block, setBlock] = useState<SizeBlockDetail | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  /** Draft M values as display strings (inches), keyed by measurementKey. */
  const [draftM, setDraftM] = useState<Record<string, string>>({});
  const [activeBlockId, setActiveBlockId] = useState<string | null>(blockId);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(blockId));
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [loadKey, setLoadKey] = useState(0);
  const [ghostUrl, setGhostUrl] = useState<string | null>(initialGhostUrl);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeMsg, setRecognizeMsg] = useState<string | null>(null);
  const [report, setReport] = useState<MeasurementReportData | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [styleKey, setStyleKey] = useState("");
  const [applying, setApplying] = useState(false);
  const pieceStyles = stylesForCategory(pieceKey);
  const styleGroups = groupedStylePresets(pieceKey);

  useEffect(() => {
    setGhostUrl(initialGhostUrl);
  }, [initialGhostUrl]);

  function onPhotoSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file?.type.startsWith("image/")) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoFile(file);
    setRecognizeMsg(null);
    setError(null);
  }

  async function onRecognizeFromPhoto() {
    if (!photoFile || !activeBlockId) return;
    setRecognizing(true);
    setRecognizeMsg("Recognising garment · building chart…");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("designId", designId);
      fd.set("blockId", activeBlockId);
      fd.set("pieceKey", pieceKey);
      fd.set("image", photoFile);
      const res = await recognizeDesignSizing(fd);
      if (!res.ok) {
        setRecognizeMsg(null);
        setError(res.error);
        return;
      }
      // Structured report, shared with AI Studio.
      const m = res.measurement;
      setReport(
        m
          ? {
              measuredOn: m.measuredOn,
              captureContext: m.landmarks.captureContext,
              anchor: m.anchor,
              corrected: m.applied.length,
              flagged: m.conflicts.length,
              warnings: m.warnings,
              detail: m.detail,
            }
          : null,
      );
      setReportReady(true);
      setRecognizeMsg(null);
      if (res.ghostUrl) setGhostUrl(res.ghostUrl);
      if (res.blockId !== activeBlockId) {
        setActiveBlockId(res.blockId);
        onForked(res.blockId);
      }
      setLoadKey((k) => k + 1);
      router.refresh();
    } catch (e) {
      setRecognizeMsg(null);
      setError(e instanceof Error ? e.message : "Recognition failed.");
    } finally {
      setRecognizing(false);
    }
  }

  async function onApplyStandard() {
    if (!styleKey || !activeBlockId) return;
    setApplying(true);
    setApplyMsg("Applying standard sizing…");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("designId", designId);
      fd.set("blockId", activeBlockId);
      fd.set("pieceKey", pieceKey);
      fd.set("styleId", styleKey);
      const res = await applyStandardStyle(fd);
      if (!res.ok) {
        setApplyMsg(null);
        setError(res.error);
        return;
      }
      setApplyMsg(
        `Applied ${res.label} · filled ${res.filled.length} row${res.filled.length === 1 ? "" : "s"}.`,
      );
      if (res.blockId !== activeBlockId) {
        setActiveBlockId(res.blockId);
        onForked(res.blockId);
      }
      setLoadKey((k) => k + 1);
      router.refresh();
    } catch (e) {
      setApplyMsg(null);
      setError(e instanceof Error ? e.message : "Could not apply style.");
    } finally {
      setApplying(false);
    }
  }

  /** Standard M value per measurement key for this piece's category — the
   *  canonical baseline every style is compared against (before customisation). */
  const stdBaseByKey = useMemo(() => {
    const seed = DEFAULT_SIZE_BLOCK_SEEDS.find(
      (s) => s.categoryKey === pieceKey.toUpperCase(),
    );
    const m: Record<string, number> = {};
    if (seed) for (const r of seed.rows) m[r.measurementKey] = r.baseValue;
    return m;
  }, [pieceKey]);

  useEffect(() => {
    setActiveBlockId(blockId);
  }, [blockId]);

  useEffect(() => {
    if (!activeBlockId) {
      setBlock(null);
      setRows([]);
      setDraftM({});
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        let id = activeBlockId;
        // Resolve existing design fork without bouncing activeBlockId mid-fetch
        // (that cancelled the previous request and left the UI stuck on Loading).
        if (defaultBlockId && id === defaultBlockId) {
          const cat = await getSizeBlock(id, { designId });
          if (cancelled) return;
          if (cat) {
            const forkId = await findDesignForkBlockId(
              designId,
              cat.categoryId,
            );
            if (cancelled) return;
            if (forkId) {
              id = forkId;
              onForked(forkId);
            }
          }
        }

        const detail = await getSizeBlock(id, { designId });
        if (cancelled) return;
        if (!detail) {
          setBlock(null);
          setRows([]);
          setDraftM({});
          setError("Size chart not found for this piece.");
          setLoading(false);
          return;
        }

        if (id !== activeBlockId) {
          setActiveBlockId(id);
        }

        setBlock(detail);
        setRows(
          detail.rows.map((r) => ({
            id: r.id,
            measurementKey: r.measurementKey,
            baseValue: r.baseValue,
            gradeIncrement: r.gradeIncrement,
            gradeOverrides: { ...r.gradeOverrides },
          })),
        );
        const drafts: Record<string, string> = {};
        for (const r of detail.rows) {
          drafts[r.measurementKey] = formatMeasure(r.baseValue, "in").replace(
            /[″']/g,
            "",
          );
        }
        setDraftM(drafts);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setBlock(null);
        setRows([]);
        setDraftM({});
        setError(e instanceof Error ? e.message : "Failed to load size guide");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on id/loadKey
  }, [activeBlockId, designId, loadKey, defaultBlockId]);

  const displaySizes = useMemo(() => {
    const selected = new Set(availableSizes);
    const onBlock = new Set(block?.sizeLabels ?? [...STANDARD_SIZE_LABELS]);
    return STANDARD_SIZE_LABELS.filter(
      (s) => selected.has(s) && onBlock.has(s),
    );
  }, [block, availableSizes]);

  /** Live preview: draft M applied via editBaseCell so the guide updates as you type. */
  const previewRows = useMemo(() => {
    return rows.map((r) => {
      const raw = draftM[r.measurementKey];
      if (raw == null || raw.trim() === "") return r;
      const parsed = parseMeasureInput(raw, "in");
      if (parsed === null) return r;
      const snapped = Math.round(parsed / 25) * 25;
      if (snapped === r.baseValue) return r;
      return { ...editBaseCell(r, snapped) };
    });
  }, [rows, draftM]);

  const grid = useMemo(() => {
    if (!block || previewRows.length === 0) return null;
    return resolveChart(
      {
        sizeLabels: block.sizeLabels,
        baseSizeLabel: block.baseSizeLabel,
      },
      previewRows.map(
        (r): SizeBlockRowInput => ({
          measurementKey: r.measurementKey,
          baseValue: r.baseValue,
          gradeIncrement: r.gradeIncrement,
          gradeOverrides: r.gradeOverrides,
        }),
      ),
      [], // pins never hold after Update — guide always follows M
    );
  }, [block, previewRows]);

  const garmentChartRows = useMemo(() => {
    if (!grid || !block) return [];
    return blockGridToGarmentChartRows({
      grid,
      measurementKeys: previewRows.map((r) => r.measurementKey),
      sizeLabels: block.sizeLabels,
      labelFor: (mk) => MEASURE_LABEL.get(mk) ?? mk,
    });
  }, [grid, block, previewRows]);

  const silhouette = useMemo(
    () =>
      inferSilhouetteFromChartRows(
        garmentChartRows,
        block?.baseSizeLabel ?? "M",
      ),
    [garmentChartRows, block?.baseSizeLabel],
  );

  const overlayRows = useMemo(
    () =>
      displayGarmentChartRows(
        garmentChartRows,
        silhouette.mode,
        block?.baseSizeLabel ?? "M",
      ),
    [garmentChartRows, silhouette.mode, block?.baseSizeLabel],
  );

  const visibleMeasurementKeys = useMemo(() => {
    const keys = new Set(overlayRows.map((r) => r.measurementKey));
    for (const row of previewRows) {
      if (!measurementKeyToPomKey(row.measurementKey)) {
        keys.add(row.measurementKey);
      }
    }
    return keys;
  }, [overlayRows, previewRows]);

  const tableDisplayRows = useMemo(
    () => previewRows.filter((r) => visibleMeasurementKeys.has(r.measurementKey)),
    [previewRows, visibleMeasurementKeys],
  );

  const displayImageUrl = ghostUrl ?? photoPreview;

  const isFork = Boolean(block?.ownerDesignId === designId);
  const inheriting = Boolean(block && block.isDefault && !isFork);

  /** Per-measurement M value for this style vs the standard house chart. */
  const mSummary = useMemo(() => {
    if (!block || !grid) return [];
    return previewRows.map((r) => {
      const cur = grid[r.measurementKey]?.[block.baseSizeLabel]?.value ?? r.baseValue;
      const std = stdBaseByKey[r.measurementKey];
      return {
        key: r.measurementKey,
        label: MEASURE_LABEL.get(r.measurementKey) ?? r.measurementKey,
        cur,
        std: std ?? null,
        delta: std == null ? null : cur - std,
      };
    });
  }, [block, grid, previewRows, stdBaseByKey]);

  /**
   * The house standard chart for this piece's category, graded across the same
   * sizes as the design's own chart — the baseline the design departs from.
   */
  const standardGrid = useMemo(() => {
    const seed = DEFAULT_SIZE_BLOCK_SEEDS.find(
      (x) => x.categoryKey === pieceKey.toUpperCase(),
    );
    if (!seed || !block) return null;
    return resolveChart(
      { sizeLabels: block.sizeLabels, baseSizeLabel: block.baseSizeLabel },
      seed.rows.map(
        (r): SizeBlockRowInput => ({
          measurementKey: r.measurementKey,
          baseValue: r.baseValue,
          gradeIncrement: r.gradeIncrement,
          gradeOverrides: r.gradeOverrides ?? {},
        }),
      ),
      [],
    );
  }, [pieceKey, block]);

  const mByKey = useMemo(
    () => new Map(mSummary.map((s) => [s.key, s])),
    [mSummary],
  );

  const dirty = useMemo(() => {
    return rows.some((r) => {
      const raw = draftM[r.measurementKey];
      if (raw == null) return false;
      const parsed = parseMeasureInput(raw, "in");
      if (parsed === null) return false;
      const snapped = Math.round(parsed / 25) * 25;
      return snapped !== r.baseValue;
    });
  }, [rows, draftM]);

  function onUpdateSizes() {
    if (!block || !activeBlockId) return;
    setError(null);

    const bases: Record<string, number> = {};
    for (const r of rows) {
      const raw = draftM[r.measurementKey] ?? "";
      const parsed = parseMeasureInput(raw, "in");
      if (parsed === null) {
        setError(`Enter a valid measure for ${MEASURE_LABEL.get(r.measurementKey) ?? r.measurementKey}`);
        return;
      }
      bases[r.measurementKey] = Math.round(parsed / 25) * 25;
    }

    const beforeGrid = grid;
    const nextPreview = rows.map((r) =>
      editBaseCell(r, bases[r.measurementKey]!),
    );
    const afterGrid = resolveChart(
      {
        sizeLabels: block.sizeLabels,
        baseSizeLabel: block.baseSizeLabel,
      },
      nextPreview,
      [],
    );
    const flash = new Set<string>();
    for (const r of rows) {
      for (const s of displaySizes) {
        const a = beforeGrid?.[r.measurementKey]?.[s]?.value;
        const b = afterGrid[r.measurementKey]?.[s]?.value;
        if (a !== b) flash.add(`${r.measurementKey}\0${s}`);
      }
    }
    setFlashKeys(flash);
    window.setTimeout(() => setFlashKeys(new Set()), 1000);

    // Optimistic local rows
    setRows(nextPreview);

    startTransition(async () => {
      const result = await updateDesignPieceBaseSizes({
        blockId: activeBlockId,
        designId,
        bases,
      });
      if (!result.ok) {
        setError(result.error);
        setLoadKey((k) => k + 1);
        return;
      }
      if (result.blockId && result.blockId !== activeBlockId) {
        setActiveBlockId(result.blockId);
        onForked(result.blockId);
      }
      setLoadKey((k) => k + 1);
      router.refresh();
    });
  }

  function onRevert() {
    if (!activeBlockId || !isFork) return;
    startTransition(async () => {
      const result = await revertSizeBlockFork(activeBlockId, designId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      onReverted();
      setActiveBlockId(defaultBlockId);
      setLoadKey((k) => k + 1);
      router.refresh();
    });
  }

  return (
    <section className="mb-5 overflow-hidden border border-ink/12 bg-milk">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/12 px-5 py-4">
        <p className="font-display text-[1.5rem] font-light text-ink">
          {titleCasePiece(pieceKey)}
        </p>
      </div>

      <div
        className={
          isFork
            ? "flex items-center justify-between gap-3 border-b border-ink/12 bg-zari/10 px-5 py-2 text-[11.5px] text-zari"
            : "flex items-center justify-between gap-3 border-b border-ink/12 bg-greige/30 px-5 py-2 text-[11.5px] text-ink/55"
        }
      >
        <span>
          {inheriting || !isFork
            ? `Size guide · ${pieceKey} house chart`
            : "Customised for this design"}
        </span>
        {isFork ? (
          <button
            type="button"
            onClick={onRevert}
            disabled={pending}
            className="underline underline-offset-2 hover:text-ink disabled:opacity-50"
          >
            Reset to default
          </button>
        ) : null}
      </div>

      {activeBlockId ? (
        <div className="border-b border-ink/12 bg-greige/20 px-5 py-4">
          <p className="mb-3 font-sans text-[10px] uppercase tracking-[0.12em] text-ink/55">
            Build from garment photo
          </p>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPhotoSelected(e.target.files)}
            />
            <button
              type="button"
              disabled={recognizing}
              onClick={() => photoRef.current?.click()}
              className="border border-ink/15 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-ink/70 hover:border-ink hover:text-ink disabled:opacity-40"
            >
              Choose photo
            </button>
            <button
              type="button"
              disabled={recognizing || !photoFile}
              onClick={() => void onRecognizeFromPhoto()}
              className="border border-zari bg-zari px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-indigo disabled:opacity-40"
            >
              {recognizing ? "Building…" : "Build size chart"}
            </button>
            {photoFile ? (
              <button
                type="button"
                disabled={recognizing}
                onClick={() => {
                  if (photoPreview) URL.revokeObjectURL(photoPreview);
                  setPhotoPreview(null);
                  setPhotoFile(null);
                  setRecognizeMsg(null);
                }}
                className="text-[11px] text-ink/45 underline underline-offset-2 hover:text-ink"
              >
                Clear photo
              </button>
            ) : null}
          </div>
          <p className="mb-3 max-w-xl text-[11.5px] text-ink/55">
            Front-on photo → AI recognises the cut, fills XS–XXL, and saves a
            ghost mannequin with the design. Edit M below to adjust; grading
            stays on the house step.
          </p>
          {reportReady ? (
            <MeasurementReport data={report} tone="light" className="mb-2" />
          ) : null}
          {recognizeMsg ? (
            <p className="mb-2 text-[11.5px] text-ink/60">{recognizeMsg}</p>
          ) : null}

          {styleGroups.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2 border-t border-ink/10 pt-4">
              <div className="flex flex-col gap-1">
                <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-ink/55">
                  Or start from a standard {titleCasePiece(pieceKey).toLowerCase()}{" "}
                  style
                </span>
                <select
                  value={styleKey}
                  onChange={(e) => setStyleKey(e.target.value)}
                  disabled={applying}
                  className="border border-ink/12 bg-milk px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ink"
                >
                  <option value="">Choose a standard style…</option>
                  {styleGroups.map((group) => (
                    <optgroup key={group.category} label={group.label}>
                      {group.presets.map((o) => (
                        <option
                          key={`${group.category}:${o.id}`}
                          value={stylePresetValue(group.category, o.id)}
                        >
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={applying || !styleKey}
                onClick={() => void onApplyStandard()}
                className="border border-ink/15 px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-ink/70 hover:border-ink hover:text-ink disabled:opacity-40"
              >
                {applying ? "Applying…" : "Apply standard sizes"}
              </button>
              {applyMsg ? (
                <span className="text-[11.5px] text-ink/60">{applyMsg}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!blockId ? (
        <p className="px-5 py-4 text-[12px] text-ink/45">
          No default size block for {pieceKey}. Create one under Settings ·
          Sizing.
        </p>
      ) : loading ? (
        <p className="px-5 py-4 text-[12px] text-ink/45">Loading size guide…</p>
      ) : error ? (
        <p className="px-5 py-4 text-[12px] text-madder" role="alert">
          {error}
        </p>
      ) : !block || rows.length === 0 ? (
        <p className="px-5 py-4 text-[12px] text-ink/45">
          This size chart has no measurements yet. Run{" "}
          <span className="font-data text-ink">
            npx tsx scripts/ensure-default-size-block-rows.ts
          </span>{" "}
          or edit the house chart under Settings · Sizing.
        </p>
      ) : !grid ? (
        <p className="px-5 py-4 text-[12px] text-ink/45">
          Could not resolve the size guide for the selected sizes.
        </p>
      ) : (
        <>
          {displayImageUrl && garmentChartRows.length > 0 ? (
            <div className="border-b border-ink/12 px-5 py-4">
              <p className="mb-3 text-[11.5px] text-ink/55">
                {silhouette.label}. Overlay follows your chart — edit M and press
                Update to re-grade every size.
              </p>
              <GarmentSizingPreview
                imageUrl={displayImageUrl}
                rows={garmentChartRows}
                unit="in"
                silhouette={silhouette.mode}
                highlightKey={highlightKey}
                baseSize={block.baseSizeLabel}
                theme="design"
              />
              {!ghostUrl && photoPreview ? (
                <p className="mt-2 text-[11px] text-ink/45">
                  Ghost generation unavailable — overlay on your upload. Save the
                  design to persist the chart; add FAL_KEY for ghost shots.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto px-5 py-4">
            <table className="w-full min-w-[28rem] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="border-b border-ink px-2.5 py-2 text-start font-sans text-[10px] font-normal uppercase tracking-[0.08em] text-ink/55">
                    Measure
                  </th>
                  {displaySizes.map((s) => (
                    <th
                      key={s}
                      className={
                        s === block.baseSizeLabel
                          ? "border-b border-ink px-2.5 py-2 text-center font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-zari"
                          : "border-b border-ink px-2.5 py-2 text-center font-sans text-[10px] font-normal uppercase tracking-[0.08em] text-ink/55"
                      }
                    >
                      {s}
                      {s === block.baseSizeLabel ? " · base" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableDisplayRows.map((row) => {
                  const overlayLabel = overlayRows.find(
                    (r) => r.measurementKey === row.measurementKey,
                  )?.label;
                  const highlighted = highlightKey === row.measurementKey;
                  return (
                  <tr
                    key={row.id}
                    className={highlighted ? "bg-zari/10" : undefined}
                    onMouseEnter={() => setHighlightKey(row.measurementKey)}
                    onMouseLeave={() => setHighlightKey(null)}
                  >
                    <td className="border-b border-ink/10 px-2.5 py-2 text-start text-[12.5px] text-ink/55">
                      {overlayLabel ??
                        MEASURE_LABEL.get(row.measurementKey) ??
                        row.measurementKey}
                      {(() => {
                        const s = mByKey.get(row.measurementKey);
                        if (!s || s.delta == null) return null;
                        if (s.delta === 0) {
                          return (
                            <span className="block text-[10px] text-ink/35">
                              same as standard
                            </span>
                          );
                        }
                        return (
                          <span className="block text-[10px] text-ink/45">
                            {s.delta > 0 ? "+" : "−"}
                            {formatMeasure(Math.abs(s.delta), "in")} vs standard
                          </span>
                        );
                      })()}
                    </td>
                    {displaySizes.map((s) => {
                      const cell = grid[row.measurementKey]?.[s];
                      const value = cell?.value ?? row.baseValue;
                      const isBase = s === block.baseSizeLabel;
                      const flashing = flashKeys.has(
                        `${row.measurementKey}\0${s}`,
                      );
                      return (
                        <td
                          key={s}
                          className={[
                            "border-b border-ink/10 px-2.5 py-2 text-center font-data text-[12.5px] text-ink transition-colors duration-1000",
                            isBase ? "bg-zari/10" : "",
                            flashing
                              ? isBase
                                ? "bg-zari/55"
                                : "bg-zari/40"
                              : "",
                          ].join(" ")}
                        >
                          {isBase ? (
                            <input
                              value={draftM[row.measurementKey] ?? ""}
                              inputMode="decimal"
                              onChange={(e) =>
                                setDraftM((prev) => ({
                                  ...prev,
                                  [row.measurementKey]: e.target.value,
                                }))
                              }
                              className="w-14 border border-zari bg-milk px-1 py-0.5 text-center font-data text-[12.5px] text-ink outline-none"
                              aria-label={`${MEASURE_LABEL.get(row.measurementKey) ?? row.measurementKey} base (M)`}
                            />
                          ) : (
                            <Measure value={value} />
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

          {standardGrid ? (
            <details className="border-t border-ink/10 px-5 py-4">
              <summary className="cursor-pointer text-[12.5px] text-ink">
                House standard for {titleCasePiece(pieceKey)} — and how this
                piece differs
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[28rem] border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      <th className="border-b border-ink/20 px-2.5 py-2 text-start font-sans text-[10px] font-normal uppercase tracking-[0.08em] text-ink/55">
                        Measure
                      </th>
                      {displaySizes.map((sz) => (
                        <th
                          key={sz}
                          className="border-b border-ink/20 px-2.5 py-2 text-center font-sans text-[10px] font-normal uppercase tracking-[0.08em] text-ink/55"
                        >
                          {sz}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableDisplayRows.map((row) => {
                      const stdRow = standardGrid[row.measurementKey];
                      if (!stdRow) return null;
                      return (
                        <tr key={`std-${row.id}`}>
                          <td className="border-b border-ink/10 px-2.5 py-2 text-start text-ink/55">
                            {MEASURE_LABEL.get(row.measurementKey) ??
                              row.measurementKey}
                          </td>
                          {displaySizes.map((sz) => {
                            const std = stdRow[sz]?.value;
                            const mine =
                              grid[row.measurementKey]?.[sz]?.value ??
                              row.baseValue;
                            const diff =
                              std == null ? null : mine - std;
                            return (
                              <td
                                key={sz}
                                className="border-b border-ink/10 px-2.5 py-2 text-center font-data text-ink/70"
                              >
                                {std == null ? (
                                  "—"
                                ) : (
                                  <>
                                    <Measure value={std} />
                                    {diff !== null && diff !== 0 ? (
                                      <span className="ms-1 text-[11px] text-zari">
                                        ({diff > 0 ? "+" : "−"}
                                        {formatMeasure(Math.abs(diff), "in")})
                                      </span>
                                    ) : null}
                                  </>
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
              <p className="mt-2 text-[11.5px] text-ink/55">
                Grey is the house standard for this garment type; gold in
                brackets is how far this piece departs from it.
              </p>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
            <p className="max-w-md text-[11.5px] text-ink/55">
              Change <span className="font-medium text-ink">M</span>, then
              press Update — every other size shifts by the same amount.
              Grading (the step between sizes) stays exactly as set.
            </p>
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={onUpdateSizes}
              className="border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-milk disabled:opacity-40"
            >
              {pending ? "Updating…" : "Update sizes"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
