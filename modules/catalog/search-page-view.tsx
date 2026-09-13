"use client";

import { Link } from "@/i18n/routing";

import { CatalogPagination } from "./catalog-pagination";
import { CollectionFilters } from "./collection-filters";
import { DesignCard } from "./design-card";
import { SearchBox } from "./search-box";
import { POPULAR_SEARCH_TERMS, SEARCH_HINT } from "./search-suggestions";
import type { PublishedDesignCard } from "./types";

type Facets = {
  occasions: string[];
  work: string[];
  garmentTypes: { key: string; name: string }[];
  fabrics: { id: string; name: string }[];
};

export function SearchPageView({
  query,
  items,
  total,
  pageCount,
  facets,
  doorLabels,
}: {
  query: string;
  items: PublishedDesignCard[];
  total: number;
  pageCount: number;
  facets: Facets;
  doorLabels: Record<string, string>;
}) {
  const hasQuery = query.length > 0;

  return (
    <div className="mx-auto max-w-[1500px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
      <nav
        className="mb-6 text-[12px] tracking-[0.05em]"
        style={{ color: "var(--taupe)" }}
      >
        <Link href="/" style={{ color: "var(--taupe)" }}>
          Home
        </Link>
        <span> / Search</span>
      </nav>

      <header className="mb-8 max-w-[640px]">
        <h1 className="serif mb-3 text-[clamp(1.8rem,3.5vw,2.4rem)] font-light leading-none">
          {hasQuery ? `Results for “${query}”` : "Search"}
        </h1>
        {!hasQuery ? (
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--espresso)" }}>
            {SEARCH_HINT}
          </p>
        ) : null}
      </header>

      <div className="search-page-bar sticky top-[4.5rem] z-30 mb-8 max-w-[640px] border-b border-[var(--line)] bg-[var(--milk)] pb-4">
        <SearchBox initialQuery={query} syncUrl />
      </div>

      {hasQuery ? (
        <>
          <CollectionFilters facets={facets} />

          <p className="mb-6 text-[13px]" style={{ color: "var(--taupe)" }}>
            {total === 0
              ? `Nothing matched “${query}”.`
              : `${total} ${total === 1 ? "piece" : "pieces"}`}
          </p>

          {total === 0 ? (
            <SearchEmptyState query={query} />
          ) : (
            <>
              <div className="grid">
                {items.map((design) => (
                  <DesignCard
                    key={design.id}
                    design={design}
                    doorLabels={doorLabels}
                  />
                ))}
              </div>
              <CatalogPagination pageCount={pageCount} />
            </>
          )}
        </>
      ) : (
        <SearchIdleState />
      )}
    </div>
  );
}

function SearchIdleState() {
  return (
    <div className="max-w-xl">
      <p className="mb-4 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--taupe)" }}>
        Popular searches
      </p>
      <div className="search-chips">
        {POPULAR_SEARCH_TERMS.map((term) => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="search-chip"
          >
            {term}
          </Link>
        ))}
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
          Browse all pieces →
        </Link>
      </p>
    </div>
  );
}

function SearchEmptyState({ query }: { query: string }) {
  return (
    <div className="max-w-xl border border-[var(--line)] bg-[var(--ivory)]/40 p-6">
      <p className="text-[15px]" style={{ color: "var(--ink)" }}>
        No pieces matched “{query}”.
      </p>
      <p className="mt-2 text-[13px]" style={{ color: "var(--taupe)" }}>
        {SEARCH_HINT}
      </p>
      <p className="mt-5 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--taupe)" }}>
        Try instead
      </p>
      <div className="search-chips mt-2">
        {POPULAR_SEARCH_TERMS.map((term) => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="search-chip"
          >
            {term}
          </Link>
        ))}
      </div>
      <p className="mt-6">
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
    </div>
  );
}
