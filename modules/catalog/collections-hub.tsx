import { ShopImage } from "@/modules/shop/media/shop-image";

import { Link } from "@/i18n/routing";

import { COLLECTIONS_HUB_INTRO } from "./house-collections";
import type { HouseCollectionPublic } from "./house-collections-queries";

export type CollectionCover = {
  imageUrl: string | null;
  pieceCount: number;
};

/** Distinct warm washes so a collection without a photo still reads as a door. */
const EMPTY_WASH = [
  "linear-gradient(160deg,#E3D7C0,#A89472)",
  "linear-gradient(160deg,#D4C6AE,#8F8068)",
  "linear-gradient(160deg,#DDD0B8,#9A8668)",
  "linear-gradient(160deg,#C8B898,#7A6B52)",
];

/**
 * Editorial span pattern on wide screens (6-col grid): two large doors, then
 * rows of three. Falls back to an even 3-up grid when the count doesn't fit.
 */
function spanClass(index: number, count: number): string {
  const editorial = count >= 5 && (count - 2) % 3 === 0;
  if (!editorial) return "lg:col-span-2";
  return index < 2 ? "lg:col-span-3" : "lg:col-span-2";
}

/** Hub of house collections — image doors with name, line and piece count. */
export function CollectionsHubPage({
  collections,
  covers = {},
}: {
  collections: HouseCollectionPublic[];
  covers?: Record<string, CollectionCover>;
}) {
  return (
    <main className="collections-hub mx-auto max-w-[1500px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem] max-[900px]:pt-20">
      <article>
        <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-light leading-tight">
              {COLLECTIONS_HUB_INTRO.line1}
            </h1>
            <p
              className="mt-3 text-[15px] leading-relaxed"
              style={{ color: "var(--espresso)" }}
            >
              {COLLECTIONS_HUB_INTRO.line2}
            </p>
          </div>
          <Link href="/collections/all" className="ch-all">
            View all pieces
            <span aria-hidden className="rtl:rotate-180">
              →
            </span>
          </Link>
        </header>

        <ul className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
          {collections.map((collection, i) => {
            const cover = covers[collection.slug];
            const large = spanClass(i, collections.length) === "lg:col-span-3";
            return (
              <li
                key={collection.slug}
                className={spanClass(i, collections.length)}
              >
                <Link
                  href={`/collections/${collection.slug}`}
                  className="ch-door group"
                >
                  <div
                    className={`ch-media ${large ? "is-large" : ""}`}
                    style={{ background: EMPTY_WASH[i % EMPTY_WASH.length] }}
                  >
                    {cover?.imageUrl ? (
                      <ShopImage
                        src={cover.imageUrl}
                        alt={collection.title}
                        fill
                        sizes={
                          large
                            ? "(max-width: 640px) 100vw, 50vw"
                            : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        }
                        className="object-cover"
                        priority={i < 2}
                      />
                    ) : null}
                  </div>
                  <div className="ch-text">
                    <p className="ch-eyebrow">
                      {collection.navLabel}
                      {cover && cover.pieceCount > 0 ? (
                        <span>
                          {cover.pieceCount}{" "}
                          {cover.pieceCount === 1 ? "piece" : "pieces"}
                        </span>
                      ) : null}
                    </p>
                    <h2 className="serif ch-title">{collection.title}</h2>
                    <p className="serif ch-tagline">{collection.tagline}</p>
                    <p className="ch-card">{collection.card}</p>
                    <span className="ch-cta">
                      View collection
                      <span aria-hidden className="rtl:rotate-180">
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </article>
    </main>
  );
}
