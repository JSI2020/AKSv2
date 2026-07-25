"use client";

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

  return (
    <div className="mb-10 space-y-6 border-b border-greige-deep pb-8">
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
          <span className="text-[13px] text-ink/50">None yet</span>
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
          <span className="text-[13px] text-ink/50">None yet</span>
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
          <span className="text-[13px] text-ink/50">None yet</span>
        ) : null}
      </FacetGroup>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-[12px] uppercase tracking-[0.08em] text-ink/55">
          Price from (PKR)
          <input
            type="number"
            min={0}
            className="w-32 border border-greige-deep bg-greige px-2 py-1.5 text-[14px] text-ink"
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
        <label className="flex flex-col gap-1 text-[12px] uppercase tracking-[0.08em] text-ink/55">
          Price to (PKR)
          <input
            type="number"
            min={0}
            className="w-32 border border-greige-deep bg-greige px-2 py-1.5 text-[14px] text-ink"
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
        <label className="flex flex-col gap-1 text-[12px] uppercase tracking-[0.08em] text-ink/55">
          Sort
          <select
            className="border border-greige-deep bg-greige px-2 py-1.5 text-[14px] text-ink"
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
        <button
          type="button"
          className="border-b border-ink pb-0.5 text-[13px] uppercase tracking-[0.05em]"
          onClick={() =>
            void setParams({
              occasion: [],
              work: [],
              garment: [],
              fabric: [],
              priceMin: null,
              priceMax: null,
              sort: "newest",
              page: 1,
            })
          }
        >
          Clear filters
        </button>
      </div>
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
      <p className="mb-2.5 font-display text-[11px] uppercase tracking-[0.14em] text-madder">
        {label}
      </p>
      <div className="flex flex-wrap gap-2.5">{children}</div>
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
      className={
        active
          ? "border border-ink bg-ink px-3.5 py-1.5 text-[13px] text-greige"
          : "border border-greige-deep bg-transparent px-3.5 py-1.5 text-[13px] text-ink"
      }
    >
      {label}
    </button>
  );
}
