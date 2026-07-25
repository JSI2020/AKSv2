"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { Measure, formatMeasure, parseMeasureInput } from "@/modules/ui";
import {
  editBaseCell,
  resolveChart,
  type PinnedCellInput,
  type SizeBlockRowInput,
} from "@/modules/sizing/engine";

import { saveSizeBlockRow, type SizeBlockDetail } from "./block-actions";
import {
  pinSizeBlockCell,
  revertSizeBlockFork,
  unpinSizeBlockCell,
} from "./fork-actions";

type DisplayUnit = "in" | "cm";

type RowState = {
  id: string;
  measurementKey: string;
  baseValue: number;
  gradeIncrement: number;
  gradeOverrides: Record<string, number>;
  sortOrder: number;
};

type PinState = {
  measurementKey: string;
  sizeLabel: string;
  value: number;
};

type Props = {
  block: SizeBlockDetail;
  /** When set, first edit of a shared default forks a private copy. */
  designId?: string | null;
  /** Studio embed — stay on sizing route after fork. */
  onBlockForked?: (blockId: string) => void;
  /** Fired when resolved base-size values change (overlay preview). */
  onGridChange?: (valuesByKey: Record<string, number>) => void;
  readOnly?: boolean;
};

function cloneRows(rows: RowState[]): RowState[] {
  return rows.map((r) => ({
    ...r,
    gradeOverrides: { ...r.gradeOverrides },
  }));
}

function pinKey(measurementKey: string, sizeLabel: string): string {
  return `${measurementKey}\0${sizeLabel}`;
}

export function SizeChartEditor({
  block,
  designId = null,
  onBlockForked,
  onGridChange,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [blockId, setBlockId] = useState(block.id);
  const [rows, setRows] = useState<RowState[]>(() => cloneRows(block.rows));
  const [pins, setPins] = useState<PinState[]>(() => [...block.pinnedCells]);
  const [unit, setUnit] = useState<DisplayUnit>("in");
  const [undoStack, setUndoStack] = useState<
    { rows: RowState[]; pins: PinState[] }[]
  >([]);
  const [redoStack, setRedoStack] = useState<
    { rows: RowState[]; pins: PinState[] }[]
  >([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const baseLabel = block.baseSizeLabel;
  const labels = block.sizeLabels;
  const isFork = Boolean(block.ownerDesignId) || blockId !== block.id;
  const inheriting = Boolean(designId) && block.isDefault && !block.ownerDesignId;

  const pinnedInputs: PinnedCellInput[] = useMemo(
    () =>
      pins.map((p) => ({
        measurementKey: p.measurementKey,
        sizeLabel: p.sizeLabel,
        value: p.value,
      })),
    [pins],
  );

  const grid = useMemo(
    () =>
      resolveChart(
        { sizeLabels: labels, baseSizeLabel: baseLabel },
        rows.map(
          (r): SizeBlockRowInput => ({
            measurementKey: r.measurementKey,
            baseValue: r.baseValue,
            gradeIncrement: r.gradeIncrement,
            gradeOverrides: r.gradeOverrides,
          }),
        ),
        pinnedInputs,
      ),
    [rows, labels, baseLabel, pinnedInputs],
  );

  useEffect(() => {
    if (!onGridChange) return;
    const valuesByKey: Record<string, number> = {};
    for (const row of rows) {
      valuesByKey[row.measurementKey] =
        grid[row.measurementKey]?.[baseLabel]?.value ?? row.baseValue;
    }
    onGridChange(valuesByKey);
  }, [grid, rows, baseLabel, onGridChange]);

  const pushHistory = useCallback(() => {
    setUndoStack((u) => [
      ...u,
      { rows: cloneRows(rows), pins: pins.map((p) => ({ ...p })) },
    ]);
    setRedoStack([]);
  }, [rows, pins]);

  const handleForkRedirect = useCallback(
    (result: { ok: true; blockId?: string; forked?: boolean } | { ok: false }) => {
      if (!result.ok) return;
      if (result.forked && result.blockId && result.blockId !== blockId) {
        setBlockId(result.blockId);
        if (onBlockForked) {
          onBlockForked(result.blockId);
          return;
        }
        const qs = designId ? `?designId=${encodeURIComponent(designId)}` : "";
        router.replace(`/admin/settings/sizing/blocks/${result.blockId}${qs}`);
        router.refresh();
      }
    },
    [blockId, designId, onBlockForked, router],
  );

  const scheduleSave = useCallback(
    (row: RowState) => {
      const existing = saveTimers.current.get(row.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        startTransition(async () => {
          const result = await saveSizeBlockRow({
            blockId,
            rowId: row.id,
            baseValue: row.baseValue,
            gradeIncrement: row.gradeIncrement,
            designId,
          });
          if (!result.ok) setSaveError(result.error);
          else {
            setSaveError(null);
            handleForkRedirect(result);
          }
        });
      }, 350);
      saveTimers.current.set(row.id, timer);
    },
    [blockId, designId, handleForkRedirect],
  );

  useEffect(() => {
    return () => {
      for (const t of saveTimers.current.values()) clearTimeout(t);
    };
  }, []);

  function onBaseChange(rowId: string, raw: string) {
    const parsed = parseMeasureInput(raw, unit);
    if (parsed === null) return;
    const current = rows.find((r) => r.id === rowId);
    if (!current || current.baseValue === parsed) return;
    pushHistory();
    const edited = editBaseCell(current, parsed);
    const next = rows.map((r) => (r.id === rowId ? { ...edited } : r));
    setRows(next);
    scheduleSave(edited);
  }

  function onIncrementChange(rowId: string, raw: string) {
    const parsed = parseMeasureInput(raw, unit);
    if (parsed === null) return;
    const current = rows.find((r) => r.id === rowId);
    if (!current || current.gradeIncrement === parsed) return;
    pushHistory();
    const edited = { ...current, gradeIncrement: parsed };
    setRows(rows.map((r) => (r.id === rowId ? edited : r)));
    scheduleSave(edited);
  }

  function onPinCell(measurementKey: string, sizeLabel: string, raw: string) {
    const parsed = parseMeasureInput(raw, unit);
    if (parsed === null) return;
    pushHistory();
    setPins((prev) => {
      const without = prev.filter(
        (p) =>
          !(p.measurementKey === measurementKey && p.sizeLabel === sizeLabel),
      );
      return [
        ...without,
        { measurementKey, sizeLabel, value: parsed },
      ];
    });
    startTransition(async () => {
      const result = await pinSizeBlockCell({
        blockId,
        measurementKey,
        sizeLabel,
        value: parsed,
        designId,
      });
      if (!result.ok) setSaveError(result.error);
      else {
        setSaveError(null);
        handleForkRedirect(result);
      }
    });
  }

  function onUnpin(measurementKey: string, sizeLabel: string) {
    pushHistory();
    setPins((prev) =>
      prev.filter(
        (p) =>
          !(p.measurementKey === measurementKey && p.sizeLabel === sizeLabel),
      ),
    );
    startTransition(async () => {
      const result = await unpinSizeBlockCell({
        blockId,
        measurementKey,
        sizeLabel,
        designId,
      });
      if (!result.ok) setSaveError(result.error);
      else {
        setSaveError(null);
        handleForkRedirect(result);
      }
    });
  }

  function undo() {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const prev = u[u.length - 1]!;
      setRedoStack((r) => [
        ...r,
        { rows: cloneRows(rows), pins: pins.map((p) => ({ ...p })) },
      ]);
      setRows(cloneRows(prev.rows));
      setPins(prev.pins.map((p) => ({ ...p })));
      for (const row of prev.rows) scheduleSave(row);
      return u.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1]!;
      setUndoStack((u) => [
        ...u,
        { rows: cloneRows(rows), pins: pins.map((p) => ({ ...p })) },
      ]);
      setRows(cloneRows(next.rows));
      setPins(next.pins.map((p) => ({ ...p })));
      for (const row of next.rows) scheduleSave(row);
      return r.slice(0, -1);
    });
  }

  function onRevert() {
    startTransition(async () => {
      const result = await revertSizeBlockFork(blockId, designId);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      if (onBlockForked && designId) {
        router.refresh();
        return;
      }
      router.push("/admin/settings/sizing/blocks");
      router.refresh();
    });
  }

  const pinLookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pins) m.set(pinKey(p.measurementKey, p.sizeLabel), p.value);
    return m;
  }, [pins]);

  return (
    <div className="flex flex-col gap-4">
      {designId ? (
        <div className="border border-indigo-lift px-3 py-2 text-[13px] text-greige">
          {inheriting && !isFork ? (
            <p>
              Inheriting {block.categoryKey} default — first edit forks a private
              chart for this design.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>Customised for this design</p>
              <button
                type="button"
                onClick={onRevert}
                className="border border-madder px-2 py-1 text-[12px] text-madder"
              >
                Revert to default
              </button>
            </div>
          )}
        </div>
      ) : block.isDefault ? (
        <p className="border border-indigo-lift px-3 py-2 text-[12px] text-chalk">
          Shared category default — edits affect every design that inherits it.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={undoStack.length === 0}
          className="border border-indigo-lift px-2 py-1 text-[12px] text-chalk disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={redoStack.length === 0}
          className="border border-indigo-lift px-2 py-1 text-[12px] text-chalk disabled:opacity-40"
        >
          Redo
        </button>
        <div className="ms-auto flex items-center gap-1 border border-indigo-lift p-0.5">
          <button
            type="button"
            onClick={() => setUnit("in")}
            className={`px-2 py-1 text-[12px] ${unit === "in" ? "bg-zari text-indigo" : "text-chalk"}`}
          >
            in
          </button>
          <button
            type="button"
            onClick={() => setUnit("cm")}
            className={`px-2 py-1 text-[12px] ${unit === "cm" ? "bg-zari text-indigo" : "text-chalk"}`}
          >
            cm
          </button>
        </div>
        <span className="font-sans text-[11px] uppercase tracking-[0.1em] text-chalk">
          {pending ? "Saving…" : "Autosave"}
        </span>
      </div>

      {saveError ? (
        <p className="text-[13px] text-madder" role="alert">
          {saveError}
        </p>
      ) : null}

      {block.notes ? (
        <p className="border border-indigo-lift px-3 py-2 text-[12px] text-chalk">
          {block.notes}
        </p>
      ) : null}

      <div className="overflow-x-auto border border-indigo-lift">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-indigo-lift bg-indigo-lift/40">
              <th className="px-2 py-2 text-start font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
                Key
              </th>
              {labels.map((label) => (
                <th
                  key={label}
                  className={`px-2 py-2 text-center font-data text-[12px] ${
                    label === baseLabel
                      ? "bg-zari/20 text-zari"
                      : "text-chalk"
                  }`}
                >
                  {label}
                  {label === baseLabel ? " · base" : ""}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
                + / size
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-indigo-lift/80 last:border-b-0"
              >
                <td className="px-2 py-1.5 font-data text-[12px] text-greige">
                  {row.measurementKey}
                </td>
                {labels.map((label) => {
                  const cell = grid[row.measurementKey]?.[label];
                  const value = cell?.value ?? row.baseValue;
                  const isBase = label === baseLabel;
                  const isPinned = pinLookup.has(
                    pinKey(row.measurementKey, label),
                  );
                  return (
                    <td
                      key={label}
                      className={`px-1 py-1 text-center ${
                        isBase ? "bg-zari/10" : ""
                      } ${isPinned ? "bg-madder/15" : ""}`}
                    >
                      {isBase ? (
                        <MeasureInput
                          value={value}
                          unit={unit}
                          disabled={readOnly}
                          onCommit={(raw) => onBaseChange(row.id, raw)}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <MeasureInput
                            value={value}
                            unit={unit}
                            disabled={readOnly}
                            onCommit={(raw) =>
                              onPinCell(row.measurementKey, label, raw)
                            }
                          />
                          {isPinned ? (
                            <button
                              type="button"
                              onClick={() =>
                                onUnpin(row.measurementKey, label)
                              }
                              className="font-sans text-[10px] uppercase tracking-[0.08em] text-madder"
                            >
                              Unpin
                            </button>
                          ) : (
                            <Measure
                              value={value}
                              unit={unit}
                              className="sr-only"
                            />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-center">
                  <MeasureInput
                    value={row.gradeIncrement}
                    unit={unit}
                    disabled={readOnly}
                    onCommit={(raw) => onIncrementChange(row.id, raw)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-chalk">
        Non-base edits pin the cell. Storage is always integer hundredths of an
        inch.
      </p>
    </div>
  );
}

function MeasureInput({
  value,
  unit,
  onCommit,
  disabled = false,
}: {
  value: number;
  unit: DisplayUnit;
  onCommit: (raw: string) => void;
  disabled?: boolean;
}) {
  const display = formatMeasure(value, unit).replace(/[″]| cm/g, "");
  const [draft, setDraft] = useState(display);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(display);
  }, [display, focused]);

  return (
    <input
      value={focused ? draft : display}
      onFocus={() => {
        setFocused(true);
        setDraft(display);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={disabled}
      className="w-16 border border-transparent bg-transparent px-1 py-0.5 text-center font-data text-[13px] text-greige outline-none focus:border-zari disabled:opacity-50"
      aria-label="measurement"
    />
  );
}
