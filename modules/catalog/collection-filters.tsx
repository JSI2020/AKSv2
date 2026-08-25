"use client";

import { useState } from "react";
import { useQueryStates } from "nuqs";

import { collectionFilterParsers, SORT_VALUES } from "./search-params";
import { titleFromTagValue } from "./types";

type FacetOptions = {
  occasions: string[];
  work: string[];
  garmentTypes: { key: string; name: string }[];
  fabrics: { id: string; name: string }[];
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function CollectionFilters({ facets }: { facets: FacetOptions }) {
  const [params, setParams] = useQueryStates(collectionFilterParsers, {
    history: "push",
    shallow: false,
  });
  const [open, setOpen] = useState(false);

  const activeCount =
    params.occasion.length +
    params.work.length +
    params.garment.length +
    params.fabric.length +
    (params.priceMin != null ? 1 : 0) +
    (params.priceMax != null ? 1 : 0);

  const clearFilters = () => {
    void setParams({
      occasion: [],
      work: [],
      garment: [],
      fabric: [],
      priceMin: null,
      priceMax: null,
      sort: "newest",
      page: 1,
    });
  };

  return (
    <div className="mb-8 border-b border-[var(--line)] pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="collection-filter-panel"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 border border-[var(--line)] px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] text-[var(--espresso)]"
            style={{ borderRadius: "var(--r)" }}
          >
            {open ? "Hide filters" : "Filter"}
            {activeCount > 0 ? (
              <span
                className="min-w-[1.25rem] bg-[var(--ink)] px-1.5 py-0.5 text-center text-[10px] text-[var(--milk)]"
                style={{ borderRadius: "var(--r)" }}
              >
                {activeCount}
              </span>
            ) : null}
          </button>

          {activeCount > 0 ? (
            <button
              type="button"
              className="border-b border-[var(--ink)] pb-0.5 text-[11px] uppercase tracking-[0.1em] text-[var(--ink)]"
              onClick={clearFilters}
            >
              Clear
            </button>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-[var(--taupe)]">
          Sort
          <select
            className="border border-[var(--line)] bg-[var(--milk)] px-2 py-2 text-[13px] normal-case tracking-normal text-[var(--ink)]"
            style={{ borderRadius: "var(--r)" }}
            value={params.sort ?? "newest"}
            onChange={(e) =>
              void setParams({
                sort: e.target.value as (typeof SORT_VALUES)[number],
                page: 1,
              })
            }
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price_asc">Price · low to high</option>
            <option value="price_desc">Price · high to low</option>
            <option value="best_selling">Best selling</option>
          </select>
        </label>
      </div>

      {open ? (
        <div
          id="collection-filter-panel"
          className="mt-6 space-y-5 border-t border-[var(--line)] pt-6"
        >
          <FacetGroup label="Occasion">
            {facets.occasions.map((value) => (
              <FacetChip
                key={value}
                active={params.occasion.includes(value)}
                label={titleFromTagValue(value)}
                onClick={() =>
                  void setParams({
                    occasion: toggleInList(params.occasion, value),
                    page: 1,
                  })
                }
              />
            ))}
            {facets.occasions.length === 0 ? (
              <span className="text-[13px] text-[var(--taupe)]">None yet</span>
            ) : null}
          </FacetGroup>

          <FacetGroup label="Garment type">
            {facets.garmentTypes.map((g) => (
              <FacetChip
                key={g.key}
                active={params.garment.includes(g.key)}
                label={g.name}
                onClick={() =>
                  void setParams({
                    garment: toggleInList(params.garment, g.key),
                    page: 1,
                  })
                }
              />
            ))}
          </FacetGroup>

          <FacetGroup label="Work">
            {facets.work.map((value) => (
              <FacetChip
                key={value}
                active={params.work.includes(value)}
                label={titleFromTagValue(value)}
                onClick={() =>
                  void setParams({
                    work: toggleInList(params.work, value),
                    page: 1,
                  })
                }
              />
            ))}
            {facets.work.length === 0 ? (
              <span className="text-[13px] text-[var(--taupe)]">None yet</span>
            ) : null}
          </FacetGroup>

          <FacetGroup label="Fabric">
            {facets.fabrics.map((f) => (
              <FacetChip
                key={f.id}
                active={params.fabric.includes(f.id)}
                label={f.name}
                onClick={() =>
                  void setParams({
                    fabric: toggleInList(params.fabric, f.id),
                    page: 1,
                  })
                }
              />
            ))}
            {facets.fabrics.length === 0 ? (
              <span className="text-[13px] text-[var(--taupe)]">None yet</span>
            ) : null}
          </FacetGroup>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-[var(--taupe)]">
              Price from (PKR)
              <input
                type="number"
                min={0}
                className="w-32 border border-[var(--line)] bg-[var(--milk)] px-2 py-1.5 text-[14px] text-[var(--ink)]"
                style={{ borderRadius: "var(--r)" }}
                value={params.priceMin ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  void setParams({
                    priceMin: raw === "" ? null : Number(raw),
                    page: 1,
                  });
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.1em] text-[var(--taupe)]">
              Price to (PKR)
              <input
                type="number"
                min={0}
                className="w-32 border border-[var(--line)] bg-[var(--milk)] px-2 py-1.5 text-[14px] text-[var(--ink)]"
                style={{ borderRadius: "var(--r)" }}
                value={params.priceMax ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  void setParams({
                    priceMax: raw === "" ? null : Number(raw),
                    page: 1,
                  });
                }}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FacetGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-[var(--taupe)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FacetChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-[13px]"
      style={{
        borderRadius: "var(--r)",
        border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--milk)" : "var(--espresso)",
      }}
    >
      {label}
    </button>
  );
}
