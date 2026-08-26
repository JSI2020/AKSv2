"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState, Money } from "@/modules/ui";

import type { StudioCatalogCard, StudioCatalogGroup } from "./studio-catalog";

type Filter = "all" | "draft" | "published";

function isPublished(status: string) {
  return status === "PUBLISHED";
}

function piecesLabel(design: StudioCatalogCard) {
  return design.components.map((c) => c.toUpperCase()).join(" + ");
}

export function DesignsCatalog({ groups }: { groups: StudioCatalogGroup[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const designs = useMemo(() => {
    const flat = groups.flatMap((g) => g.designs);
    const term = q.trim().toLowerCase();
    return flat.filter((d) => {
      if (filter === "published" && !isPublished(d.status)) return false;
      if (filter === "draft" && isPublished(d.status)) return false;
      if (!term) return true;
      return (
        d.name.toLowerCase().includes(term) ||
        d.subtitle.toLowerCase().includes(term) ||
        d.categoryName.toLowerCase().includes(term) ||
        d.categoryKey.toLowerCase().includes(term)
      );
    });
  }, [groups, q, filter]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search designs…"
          className="min-w-[200px] flex-1 border border-ink/12 bg-milk px-3.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink/40 focus:border-ink"
        />
        {(
          [
            ["all", "All"],
            ["draft", "Draft"],
            ["published", "Published"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "border border-ink bg-ink px-3 py-1.5 text-[11px] uppercase tracking-[0.05em] text-milk"
                : "border border-ink/12 bg-milk px-3 py-1.5 text-[11px] uppercase tracking-[0.05em] text-ink/55 hover:border-ink"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {designs.length === 0 ? (
        <EmptyState
          tone="on-greige"
          title="No designs match"
          description="Try another filter, or clear search to see the full catalogue."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {designs.map((design) => (
            <DesignCard key={design.id} design={design} />
          ))}
        </div>
      )}
    </div>
  );
}

function DesignCard({ design }: { design: StudioCatalogCard }) {
  const href = `/admin/designs/${design.id}?tab=Details`;
  const live = isPublished(design.status);
  const sizes = design.availableSizeLabels;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden border border-ink/12 bg-milk transition-colors hover:border-ink"
    >
      <div className="relative aspect-[3/4] bg-greige">
        {design.thumbnailUrl ? (
          <Image
            src={design.thumbnailUrl}
            alt={design.thumbnailAlt}
            fill
            sizes="(max-width:900px) 50vw, 25vw"
            className="object-cover"
            unoptimized
          />
        ) : null}
        <span
          className={
            live
              ? "absolute top-2.5 inset-inline-start-2.5 bg-chalk px-2 py-0.5 text-[8.5px] uppercase tracking-[0.1em] text-milk"
              : "absolute top-2.5 inset-inline-start-2.5 border border-ink/15 bg-milk px-2 py-0.5 text-[8.5px] uppercase tracking-[0.1em] text-ink/55"
          }
        >
          {live ? "Published" : "Draft"}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-3.5 py-3.5">
        <p className="font-display text-[1.15rem] leading-tight text-ink">
          {design.name}
        </p>
        <p className="mt-1 text-[10.5px] uppercase tracking-[0.08em] text-ink/55">
          {piecesLabel(design)}
        </p>
        {design.basePriceMinor > 0 ? (
          <p className="mt-2 font-data text-[12px] text-ink">
            <Money value={design.basePriceMinor} />
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-ink/40">No price</p>
        )}
        {sizes.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {sizes.map((s) => (
              <span
                key={s}
                className="border border-ink/12 px-1.5 py-0.5 font-data text-[9px] text-ink/55"
              >
                {s}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
