"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DesignCard } from "@/modules/catalog/design-card";
import type { PublishedDesignCard } from "@/modules/catalog/types";
import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

import { Reveal } from "./reveal";

const FILTERS = ["All", "Essentials", "Tailored", "Occasion", "Signature"] as const;
type Filter = (typeof FILTERS)[number];

const TAG_BY_FILTER: Record<Exclude<Filter, "All">, string> = {
  Essentials: "ESSENTIALS",
  Tailored: "TAILORED",
  Occasion: "OCCASION",
  Signature: "SIGNATURE",
};

function matchesFilter(design: PublishedDesignCard, filter: Filter): boolean {
  if (filter === "All") return true;
  const tag = TAG_BY_FILTER[filter];
  return design.freeTags.some((t) => {
    const upper = t.toUpperCase();
    if (upper === tag) return true;
    return filter === "Signature" && upper === "WHITE_COLLECTION";
  });
}

export function EditGrid({ designs }: { designs: PublishedDesignCard[] }) {
  const t = useTranslations("HomeProto");
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(
    () => designs.filter((d) => matchesFilter(d, filter)),
    [designs, filter],
  );

  return (
    <Reveal as="section" className="edit" id="edit">
      <div className="edit-head">
        <div>
          <span className="eyebrow">{t("editEyebrow")}</span>
          <h2 className="serif">{t("editTitle")}</h2>
        </div>
      </div>
      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? "on" : undefined}
            onClick={() => setFilter(f)}
          >
            {f === "All" ? t("filterAll") : HOUSE_COLLECTIONS.find((c) => c.navLabel === f)?.navLabel ?? f}
          </button>
        ))}
      </div>
      <div className="grid">
        {filtered.map((design) => (
          <DesignCard key={design.id} design={design} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <p style={{ color: "var(--taupe)", fontSize: "14px", marginTop: "1rem" }}>
          {t("editEmpty")}
        </p>
      ) : null}
    </Reveal>
  );
}
