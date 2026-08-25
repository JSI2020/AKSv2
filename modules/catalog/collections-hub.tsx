import { Link } from "@/i18n/routing";

import {
  COLLECTIONS_HUB_INTRO,
  HOUSE_COLLECTIONS,
} from "./house-collections";

/** Hub above the house collection tiles — milk / shop-proto typography. */
export function CollectionsHubPage() {
  return (
    <main className="collections-hub mx-auto max-w-[1500px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
      <article>
        <header className="mb-14 max-w-xl">
          <p className="serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-light leading-tight">
            {COLLECTIONS_HUB_INTRO.line1}
          </p>
          <p
            className="mt-3 text-[15px] leading-relaxed"
            style={{ color: "var(--espresso)" }}
          >
            {COLLECTIONS_HUB_INTRO.line2}
          </p>
        </header>

        <ul
          className="grid gap-0 border-t md:grid-cols-2 lg:grid-cols-3"
          style={{ borderColor: "var(--line)" }}
        >
          {HOUSE_COLLECTIONS.map((collection) => (
            <li
              key={collection.slug}
              className="border-b border-e"
              style={{ borderColor: "var(--line)" }}
            >
              <Link
                href={`/collections/${collection.slug}`}
                className="flex h-full flex-col p-7 md:p-9"
              >
                <p
                  className="text-[10.5px] uppercase tracking-[0.34em]"
                  style={{ color: "var(--taupe)" }}
                >
                  {collection.navLabel}
                </p>
                <h2 className="serif mt-3 text-[1.7rem] font-normal leading-tight">
                  {collection.title}
                </h2>
                <p
                  className="serif mt-2 text-[1rem] italic"
                  style={{ color: "var(--taupe)" }}
                >
                  {collection.tagline}
                </p>
                <p
                  className="mt-4 flex-1 text-[14px] leading-relaxed"
                  style={{ color: "var(--espresso)" }}
                >
                  {collection.card}
                </p>
                <span
                  className="mt-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]"
                  style={{
                    borderBottom: "1px solid var(--ink)",
                    paddingBottom: 3,
                    alignSelf: "flex-start",
                  }}
                >
                  View collection
                  <span aria-hidden className="rtl:rotate-180">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </main>
  );
}
