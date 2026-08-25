"use client";

import { useMemo, useState } from "react";

import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

import { InventoryPhotoCard } from "./inventory-photo-card";
import type { RtwDesignCard } from "./ledger-queries";

type StockFilter = "all" | "low" | "in_stock" | "zero";
type StatusFilter = "all" | "PUBLISHED" | "DRAFT" | "READY_TO_PUBLISH";

const STOCK_FILTERS: { id: StockFilter; label: string }[] = [
  { id: "all", label: "All stock" },
  { id: "low", label: "Low" },
  { id: "in_stock", label: "In stock" },
  { id: "zero", label: "Zero" },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All status" },
  { id: "PUBLISHED", label: "Published" },
  { id: "DRAFT", label: "Draft" },
  { id: "READY_TO_PUBLISH", label: "Ready" },
];

const UNCATEGORISED = "UNCATEGORISED";

function chipClass(on: boolean) {
  return on
    ? "border border-ink bg-ink px-2.5 py-1.5 text-[11px] uppercase tracking-[0.06em] text-milk"
    : "border border-ink/12 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.06em] text-ink/55 hover:border-ink";
}

export function RtwDesignsInventoryView({ cards }: { cards: RtwDesignCard[] }) {
  const [query, setQuery] = useState("");
  const [house, setHouse] = useState<string>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (house !== "all") {
        if (house === UNCATEGORISED) {
          if (c.houseDoor) return false;
        } else if (c.houseDoor !== house) {
          return false;
        }
      }
      if (status !== "all" && c.status !== status) return false;
      if (stock === "low" && !c.lowSize) return false;
      if (stock === "in_stock" && c.totalUnits <= 0) return false;
      if (stock === "zero" && c.totalUnits !== 0) return false;
      if (!q) return true;
      const hay = `${c.name} ${c.itemNumber ?? ""} ${c.houseDoor ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cards, query, house, stock, status]);

  const grouped = useMemo(() => {
    const sections: {
      key: string;
      title: string;
      cards: RtwDesignCard[];
    }[] = [];

    for (const col of HOUSE_COLLECTIONS) {
      const list = filtered.filter((c) => c.houseDoor === col.tag);
      if (list.length === 0) continue;
      sections.push({
        key: col.tag,
        title: col.navLabel,
        cards: list,
      });
    }

    const other = filtered.filter((c) => !c.houseDoor);
    if (other.length > 0) {
      sections.push({
        key: UNCATEGORISED,
        title: "Uncategorised",
        cards: other,
      });
    }

    return sections;
  }, [filtered]);

  const houseCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) {
      const k = c.houseDoor ?? UNCATEGORISED;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [cards]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border border-ink/12 bg-milk px-4 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, item number…"
            className="border border-ink/12 bg-greige/30 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink/35 focus:border-ink"
          />
        </label>

        <div>
          <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
            House door
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chipClass(house === "all")}
              onClick={() => setHouse("all")}
            >
              All ({cards.length})
            </button>
            {HOUSE_COLLECTIONS.map((col) => {
              const n = houseCounts.get(col.tag) ?? 0;
              return (
                <button
                  key={col.tag}
                  type="button"
                  className={chipClass(house === col.tag)}
                  onClick={() => setHouse(col.tag)}
                >
                  {col.navLabel}
                  {n > 0 ? ` (${n})` : ""}
                </button>
              );
            })}
            {(houseCounts.get(UNCATEGORISED) ?? 0) > 0 ? (
              <button
                type="button"
                className={chipClass(house === UNCATEGORISED)}
                onClick={() => setHouse(UNCATEGORISED)}
              >
                Uncategorised ({houseCounts.get(UNCATEGORISED)})
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
              Stock
            </p>
            <div className="flex flex-wrap gap-2">
              {STOCK_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={chipClass(stock === f.id)}
                  onClick={() => setStock(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
              Status
            </p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={chipClass(status === f.id)}
                  onClick={() => setStatus(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[13px] text-ink/55">
          No designs match these filters.
        </p>
      ) : (
        grouped.map((section) => (
          <section key={section.key} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 border-b border-ink/12 pb-2">
              <h2 className="font-display text-[1.5rem] font-light text-ink">
                {section.title}
              </h2>
              <span className="font-data text-[12px] text-ink/45">
                {section.cards.length}
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {section.cards.map((c) => (
                <InventoryPhotoCard
                  key={c.id}
                  href={`/admin/inventory/designs/${c.id}`}
                  title={c.name}
                  meta={[
                    c.itemNumber,
                    `${c.colourwayCount} colourway${c.colourwayCount === 1 ? "" : "s"}`,
                    c.status === "PUBLISHED" ? null : c.status.toLowerCase(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  stockLabel="Total units"
                  stockValue={String(c.totalUnits)}
                  low={c.lowSize}
                  lowTag="Low size"
                  gradient={c.gradient}
                  hexes={c.hexes}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
