import { Link } from "@/i18n/routing";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

import {
  COLLECTIONS_HUB_INTRO,
  HOUSE_COLLECTIONS,
} from "./house-collections";

/** Hub above the five house collection tiles. */
export function CollectionsHubPage() {
  return (
    <ShopPageContainer>
      <article className="py-12 md:py-16">
        <header className="mb-14 max-w-xl">
          <p className="font-display text-[clamp(28px,3.5vw,40px)] font-medium leading-tight text-ink">
            {COLLECTIONS_HUB_INTRO.line1}
          </p>
          <p className="mt-3 text-[16px] leading-relaxed text-ink/70">
            {COLLECTIONS_HUB_INTRO.line2}
          </p>
        </header>

        <ul className="grid gap-0 border-t border-greige-deep md:grid-cols-2 lg:grid-cols-3">
          {HOUSE_COLLECTIONS.map((collection) => (
            <li
              key={collection.slug}
              className="border-b border-e border-greige-deep"
            >
              <Link
                href={`/collections/${collection.slug}`}
                className="flex h-full flex-col p-7 transition-colors hover:bg-greige-deep/30 md:p-9"
              >
                <p className="text-[12px] uppercase tracking-[0.12em] text-ink/50">
                  {collection.navLabel}
                </p>
                <h2 className="mt-3 font-display text-[28px] font-medium leading-tight text-ink">
                  {collection.title}
                </h2>
                <p className="mt-2 font-display text-[16px] italic text-ink/65">
                  {collection.tagline}
                </p>
                <p className="mt-4 flex-1 text-[14px] leading-relaxed text-ink/70">
                  {collection.card}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.12em] text-ink">
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
    </ShopPageContainer>
  );
}
