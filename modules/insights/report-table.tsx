"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ReportColumn<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  csv?: (row: T) => string;
};

type ReportTableProps<T extends Record<string, unknown>> = {
  title: string;
  rows: T[];
  columns: ReportColumn<T>[];
  filterKeys?: (keyof T)[];
  exportFilename?: string;
  getRowHref?: (row: T) => string | null;
};

function cellValue<T>(row: T, col: ReportColumn<T>): string {
  if (col.csv) return col.csv(row);
  const val = row[col.key as keyof T];
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export function ReportTable<T extends Record<string, unknown>>({
  title,
  rows,
  columns,
  filterKeys,
  exportFilename,
  getRowHref,
}: ReportTableProps<T>) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    const keys = filterKeys ?? (Object.keys(rows[0] ?? {}) as (keyof T)[]);
    return rows.filter((row) =>
      keys.some((key) => String(row[key] ?? "").toLowerCase().includes(q)),
    );
  }, [filter, filterKeys, rows]);

  function exportCsv() {
    const header = columns.map((c) => c.header).join(",");
    const body = filtered
      .map((row) =>
        columns
          .map((col) => {
            const raw = cellValue(row, col).replace(/"/g, '""');
            return `"${raw}"`;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename ?? `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="border border-indigo-lift p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
          />
          <button
            type="button"
            onClick={exportCsv}
            className="border border-zari px-2 py-1 text-[12px] text-zari"
          >
            Export CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-[13px] text-chalk">No rows match.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-indigo-lift text-chalk">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className="px-2 py-1.5 text-start font-normal"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => {
                const href = getRowHref?.(row) ?? null;
                return (
                  <tr
                    key={index}
                    className="border-b border-indigo-lift/50 text-greige"
                  >
                    {columns.map((col) => {
                      const content = col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? "—");
                      return (
                        <td key={String(col.key)} className="px-2 py-1.5">
                          {href && col === columns[0] ? (
                            <Link href={href} className="text-zari hover:underline">
                              {content}
                            </Link>
                          ) : (
                            content
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
      )}
      <p className="mt-2 font-data text-[11px] text-chalk">
        {filtered.length} of {rows.length} rows
      </p>
    </section>
  );
}
