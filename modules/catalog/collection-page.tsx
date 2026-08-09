import { Link } from "@/i18n/routing";

import { HOUSE_COLLECTIONS } from "./house-collections";
import { CollectionFilters } from "./collection-filters";
import { DesignCard } from "./design-card";
import type { PublishedDesignCard, ResolvedCollection } from "./types";

const COLLECTION_PILLS = [
  ...HOUSE_COLLECTIONS.map((c) => ({
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
    <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-9 md:px-10">
      <nav className="mb-6 text-[12px] tracking-[0.05em] text-ink/55">
        <Link href="/" className="text-ink/55">
          Home
        </Link>
        <span> / </span>
        <Link href="/collections" className="text-ink/55">
          Collections
        </Link>
        <span> / </span>
        <span>{collection.title}</span>
      </nav>

      <header className="mb-9 max-w-[640px]">
        <h1 className="mb-2.5 font-display text-[clamp(36px,4.5vw,46px)] font-medium leading-none">
          {collection.title}
        </h1>
        {collection.tagline ? (
          <p className="mb-4 font-display text-[18px] italic text-ink/65">
            {collection.tagline}
          </p>
        ) : null}
        <p className="text-[15px] leading-relaxed text-ink/65">
          {collection.description}
        </p>
      </header>

      <div className="mb-11 flex flex-wrap gap-2.5">
        {COLLECTION_PILLS.map((pill) => {
          const active = collection.slug === pill.slug;
          return (
            <Link
              key={pill.slug}
              href={`/collections/${pill.slug}`}
              className={
                active
                  ? "border border-ink bg-ink px-4 py-2 text-[13px] text-greige"
                  : "border border-greige-deep px-4 py-2 text-[13px] text-ink"
              }
            >
              {pill.label}
            </Link>
          );
        })}
      </div>

      <CollectionFilters facets={facets} />

      <p className="mb-6 text-[13px] text-ink/55">
        {total === 0
          ? "No pieces in this collection yet — check back as we open slots."
          : `${total} ${total === 1 ? "piece" : "pieces"}`}
      </p>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-7 lg:grid-cols-4">
        {items.map((design) => (
          <DesignCard key={design.id} design={design} />
        ))}
      </div>
    </main>
  );
}
