import { Link } from "@/i18n/routing";

import { HOUSE_COLLECTIONS } from "./house-collections";
import { CollectionFilters } from "./collection-filters";
import { DesignCard } from "./design-card";
import type { PublishedDesignCard, ResolvedCollection } from "./types";

const COLLECTION_PILLS = [
  ...HOUSE_COLLECTIONS.filter((c) =>
    ["essentials", "tailored", "occasion", "signature", "separates"].includes(
      c.slug,
    ),
  ).map((c) => ({
    slug: c.slug,
    label: c.navLabel,
  })),
  { slug: "new", label: "New" },
] as const;

type Facets = {
  occasions: string[];
  work: string[];
  garmentTypes: { key: string; name: string }[];
  fabrics: { id: string; name: string }[];
};

export function CollectionPageView({
  collection,
  items,
  total,
  facets,
}: {
  collection: ResolvedCollection;
  items: PublishedDesignCard[];
  total: number;
  facets: Facets;
}) {
  return (
    <main className="collection-page mx-auto max-w-[1500px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
      <nav
        className="mb-6 text-[12px] tracking-[0.05em]"
        style={{ color: "var(--taupe)" }}
      >
        <Link href="/" style={{ color: "var(--taupe)" }}>
          Home
        </Link>
        <span> / </span>
        <Link href="/collections" style={{ color: "var(--taupe)" }}>
          Collections
        </Link>
        <span> / </span>
        <span style={{ color: "var(--ink)" }}>{collection.title}</span>
      </nav>

      <header className="mb-9 max-w-[640px]">
        <h1
          className="serif mb-2.5 text-[clamp(2rem,4vw,2.8rem)] font-light leading-none"
        >
          {collection.title}
        </h1>
        {collection.tagline ? (
          <p
            className="serif mb-4 text-[1.15rem] italic"
            style={{ color: "var(--taupe)" }}
          >
            {collection.tagline}
          </p>
        ) : null}
        <p style={{ color: "var(--espresso)", fontSize: "15px", lineHeight: 1.7 }}>
          {collection.description}
        </p>
      </header>

      <div className="filters mb-8">
        {COLLECTION_PILLS.map((pill) => {
          const active = collection.slug === pill.slug;
          return (
            <Link
              key={pill.slug}
              href={`/collections/${pill.slug}`}
              className={active ? "on" : undefined}
              style={{
                display: "inline-block",
                fontSize: "11px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "0.5rem 0.9rem",
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                color: active ? "var(--milk)" : "var(--espresso)",
                background: active ? "var(--ink)" : "transparent",
                borderColor: active ? "var(--ink)" : "var(--line)",
              }}
            >
              {pill.label}
            </Link>
          );
        })}
      </div>

      <CollectionFilters facets={facets} />

      <p
        className="mb-6 text-[13px]"
        style={{ color: "var(--taupe)" }}
      >
        {total === 0
          ? "No pieces in this collection yet — check back as we open slots."
          : `${total} ${total === 1 ? "piece" : "pieces"}`}
      </p>

      <div className="grid">
        {items.map((design) => (
          <DesignCard key={design.id} design={design} />
        ))}
      </div>
    </main>
  );
}
