"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { DesignCard } from "@/modules/catalog/design-card";
import type { PublishedDesignCard } from "@/modules/catalog/types";

import { Reveal } from "./reveal";

type DoorFilter = { label: string; tag: string };

function matchesFilter(
  design: PublishedDesignCard,
  filter: DoorFilter | null,
): boolean {
  if (!filter) return true;
  return design.freeTags.some((t) => {
    const upper = t.toUpperCase();
    if (upper === filter.tag) return true;
    return filter.tag === "SIGNATURE" && upper === "WHITE_COLLECTION";
  });
}

export function EditGrid({
  designs,
  doorFilters,
  doorLabels,
}: {
  designs: PublishedDesignCard[];
  doorFilters: DoorFilter[];
  doorLabels: Record<string, string>;
}) {
  const t = useTranslations("HomeProto");
  const filters: Array<DoorFilter | null> = [null, ...doorFilters];
  const [filterIdx, setFilterIdx] = useState(0);
  const activeFilter = filters[filterIdx] ?? null;

  const filtered = useMemo(
    () => designs.filter((d) => matchesFilter(d, activeFilter)),
    [designs, activeFilter],
  );

  return (
    <Reveal as="section" className="edit" id="edit">
      <div className="edit-head">
        <span className="eyebrow">{t("editEyebrow")}</span>
        <h2 className="serif">{t("editTitle")}</h2>
      </div>
      <div className="filters">
        {filters.map((f, i) => (
          <button
            key={f?.tag ?? "all"}
            type="button"
            className={i === filterIdx ? "on" : undefined}
            onClick={() => setFilterIdx(i)}
          >
            {f ? f.label : t("filterAll")}
          </button>
        ))}
      </div>
      <div className="grid">
        {filtered.length === 0 ? (
          <p className="col-span-full text-[14px]" style={{ color: "var(--taupe)" }}>
            No pieces in this edit yet.{" "}
            <Link href="/collections/all" className="underline">
              Browse all pieces
            </Link>
          </p>
        ) : (
          filtered.map((d) => (
            <DesignCard key={d.id} design={d} doorLabels={doorLabels} />
          ))
        )}
      </div>
      <p className="mt-8">
        <Link
          href="/collections/all"
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{
            borderBottom: "1px solid var(--ink)",
            paddingBottom: 3,
            color: "var(--ink)",
          }}
        >
          View all pieces →
        </Link>
      </p>
    </Reveal>
  );
}
