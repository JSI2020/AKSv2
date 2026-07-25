"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { Measure, formatMeasure, parseMeasureInput } from "@/modules/ui";
import {
  editBaseCell,
  resolveChart,
  type SizeBlockRowInput,
} from "@/modules/sizing/engine";

import {
  saveSizeBlockRow,
  type SizeBlockDetail,
} from "./block-actions";

type DisplayUnit = "in" | "cm";

type RowState = {
  id: string;
  measurementKey: string;
  baseValue: number;
  gradeIncrement: number;
  gradeOverrides: Record<string, number>;
  sortOrder: number;
};

type Snapshot = RowState[];

type Props = {
  block: SizeBlockDetail;
};

function cloneRows(rows: RowState[]): RowState[] {
  return rows.map((r) => ({
    ...r,
    gradeOverrides: { ...r.gradeOverrides },
  }));
}

export function SizeChartEditor({ block }: Props) {
  const [rows, setRows] = useState<RowState[]>(() =>
    cloneRows(block.rows),
  );
  const [unit, setUnit] = useState<DisplayUnit>("in");
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const baseLabel = block.baseSizeLabel;
  const labels = block.sizeLabels;

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
      ),
    [rows, labels, baseLabel],
  );

  const scheduleSave = useCallback(
    (row: RowState) => {
      const existing = saveTimers.current.get(row.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        startTransition(async () => {
          const result = await saveSizeBlockRow({
            blockId: block.id,
            rowId: row.id,
            baseValue: row.baseValue,
            gradeIncrement: row.gradeIncrement,
          });
          if (!result.ok) setSaveError(result.error);
          else setSaveError(null);
        });
      }, 350);
      saveTimers.current.set(row.id, timer);
    },
    [block.id],
  );

  useEffect(() => {
    return () => {
      for (const t of saveTimers.current.values()) clearTimeout(t);
    };
  }, []);

  function commit(next: RowState[], changed: RowState) {
    setUndoStack((u) => [...u, cloneRows(rows)]);
    setRedoStack([]);
    setRows(next);
    scheduleSave(changed);
  }

  function onBaseChange(rowId: string, raw: string) {
    const parsed = parseMeasureInput(raw, unit);
    if (parsed === null) return;
    const current = rows.find((r) => r.id === rowId);
    if (!current || current.baseValue === parsed) return;
    const edited = editBaseCell(current, parsed);
    const next = rows.map((r) => (r.id === rowId ? { ...edited } : r));
    commit(next, edited);
  }

  function onIncrementChange(rowId: string, raw: string) {
    const parsed = parseMeasureInput(raw, unit);
    if (parsed === null) return;
    const current = rows.find((r) => r.id === rowId);
    if (!current || current.gradeIncrement === parsed) return;
    const edited = { ...current, gradeIncrement: parsed };
    const next = rows.map((r) => (r.id === rowId ? edited : r));
    commit(next, edited);
  }

  function undo() {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const prev = u[u.length - 1]!;
      setRedoStack((r) => [...r, cloneRows(rows)]);
      setRows(cloneRows(prev));
      for (const row of prev) scheduleSave(row);
      return u.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1]!;
      setUndoStack((u) => [...u, cloneRows(rows)]);
      setRows(cloneRows(next));
      for (const row of next) scheduleSave(row);
      return r.slice(0, -1);
    });
  }

  return (
    <div className="flex flex-col gap-4">
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
                  return (
                    <td
                      key={label}
                      className={`px-1 py-1 text-center ${
                        isBase ? "bg-zari/10" : ""
                      }`}
                    >
                      {isBase ? (
                        <MeasureInput
                          value={value}
                          unit={unit}
                          onCommit={(raw) => onBaseChange(row.id, raw)}
                        />
                      ) : (
                        <Measure
                          value={value}
                          unit={unit}
                          className="text-greige"
                        />
                      )}
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-center">
                  <MeasureInput
                    value={row.gradeIncrement}
                    unit={unit}
                    onCommit={(raw) => onIncrementChange(row.id, raw)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-chalk">
        Storage is always integer hundredths of an inch. Display unit is
        cosmetic only.
      </p>
    </div>
  );
}

function MeasureInput({
  value,
  unit,
  onCommit,
}: {
  value: number;
  unit: DisplayUnit;
  onCommit: (raw: string) => void;
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
      className="w-16 border border-transparent bg-transparent px-1 py-0.5 text-center font-data text-[13px] text-greige outline-none focus:border-zari"
      aria-label="measurement"
    />
  );
}
