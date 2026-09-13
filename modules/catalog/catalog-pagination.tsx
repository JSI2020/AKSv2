"use client";

import { useQueryStates } from "nuqs";

import { collectionFilterParsers } from "./search-params";

export function CatalogPagination({ pageCount }: { pageCount: number }) {
  const [params, setParams] = useQueryStates(collectionFilterParsers, {
    history: "push",
    shallow: false,
  });

  if (pageCount <= 1) return null;

  const page = params.page ?? 1;
  const prev = page > 1 ? page - 1 : null;
  const next = page < pageCount ? page + 1 : null;

  return (
    <nav
      className="mt-12 flex flex-wrap items-center justify-center gap-4 border-t pt-8"
      style={{ borderColor: "var(--line)" }}
      aria-label="Results pages"
    >
      {prev ? (
        <button
          type="button"
          className="text-[12px] uppercase tracking-[0.12em]"
          style={{ color: "var(--ink)" }}
          onClick={() => void setParams({ page: prev })}
        >
          ← Previous
        </button>
      ) : (
        <span className="text-[12px] text-[var(--taupe)]">← Previous</span>
      )}
      <span className="font-data text-[13px]" style={{ color: "var(--espresso)" }}>
        Page {page} of {pageCount}
      </span>
      {next ? (
        <button
          type="button"
          className="text-[12px] uppercase tracking-[0.12em]"
          style={{ color: "var(--ink)" }}
          onClick={() => void setParams({ page: next })}
        >
          Next →
        </button>
      ) : (
        <span className="text-[12px] text-[var(--taupe)]">Next →</span>
      )}
    </nav>
  );
}
