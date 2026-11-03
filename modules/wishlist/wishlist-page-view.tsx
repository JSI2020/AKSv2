"use client";

import { Link } from "@/i18n/routing";
import { ShopImage } from "@/modules/shop/media/shop-image";
import { formatMoney } from "@/modules/ui/money/money";

import { removeWish, useWishlist } from "./store";

export function WishlistPageView() {
  const items = useWishlist();

  return (
    <div className="mx-auto max-w-[1100px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
      <header className="mb-8">
        <p
          className="font-sans text-[11px] uppercase tracking-[0.2em]"
          style={{ color: "var(--taupe)" }}
        >
          Saved
        </p>
        <h1 className="serif mt-1 text-[clamp(2rem,4vw,2.6rem)] font-light leading-none">
          Your wishlist
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: "var(--taupe)" }}>
          {items.length === 0
            ? "Nothing saved yet."
            : `${items.length} ${items.length === 1 ? "piece" : "pieces"} kept for later.`}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="border-y border-greige-deep py-16 text-center">
          <p className="text-[15px] leading-relaxed text-ink/70">
            Tap the heart on any piece to keep it here — saved on this device,
            no account needed.
          </p>
          <Link
            href="/collections"
            className="btn-primary mt-6 inline-block"
            style={{ width: "auto" }}
          >
            Browse the collection
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <li key={it.id} className="group relative">
              <Link href={`/designs/${it.slug}` as "/"} className="block">
                <div className="relative aspect-[3/4] overflow-hidden bg-greige">
                  {it.thumbnailUrl ? (
                    <ShopImage
                      src={it.thumbnailUrl}
                      alt={it.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <p className="mt-3 font-display text-[15px] leading-snug text-ink">
                  {it.name}
                </p>
                {it.garmentType ? (
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-ink/50">
                    {it.garmentType}
                  </p>
                ) : null}
                <p className="mt-1 font-data text-[13px] text-ink/80">
                  {formatMoney(it.priceMinor, "PKR")}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => removeWish(it.id)}
                className="mt-2 text-[12px] text-ink/45 underline-offset-2 hover:text-madder hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
