import { getTranslations, getLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { AksWordmark } from "./brand";

const WHATSAPP = "https://wa.me/923001234567";
const INSTAGRAM = "https://instagram.com/aks.atelier";

export async function ShopUtilityBar() {
  const t = await getTranslations("Utility");

  return (
    <div className="flex items-center justify-center gap-2 bg-ink px-6 py-2.5 text-center text-[12px] uppercase tracking-[0.06em] text-greige">
      <span>{t("leadTime")}</span>
      <span className="opacity-50">·</span>
      <a
        href={WHATSAPP}
        className="inline-flex items-center gap-1.5 text-zari"
        rel="noreferrer"
        target="_blank"
      >
        {t("whatsapp")}
      </a>
    </div>
  );
}

export async function ShopMarquee() {
  const t = await getTranslations("Marquee");
  const items = t.raw("items") as string[];
  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-greige-deep bg-greige-deep/40 py-2.5">
      <div className="shop-marquee-track flex w-max gap-9">
        {loop.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-9 whitespace-nowrap font-display text-[12px] uppercase tracking-[0.14em] text-ink/70"
          >
            {item}
            <span className="text-[10px] text-zari" aria-hidden>
              ◆
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export async function ShopHeader({ cartCount = 0 }: { cartCount?: number }) {
  const t = await getTranslations("Nav");
  const brand = await getTranslations("Brand");
  const locale = await getLocale();
  const otherLocale = locale === "en" ? "ur" : "en";

  const nav = [
    { href: "/collections/new" as const, label: t("new") },
    { href: "/collections/formal" as const, label: t("formal") },
    { href: "/collections/fusion" as const, label: t("fusion") },
    { href: "/fabrics" as const, label: t("fabrics") },
    { href: "/size-guide" as const, label: t("sizeGuide") },
  ];

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-greige-deep bg-greige/95 px-4 py-4 backdrop-blur-md md:px-10">
      <AksWordmark name={brand("name")} nameUr={brand("nameUr")} />

      <nav
        className="hidden items-center gap-7 text-[14px] tracking-[0.02em] lg:flex"
        aria-label="Primary"
      >
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border-b border-transparent pb-0.5 text-ink transition-colors hover:border-madder"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3 text-[13px] text-ink sm:gap-4">
        <Link
          href="/"
          locale={otherLocale}
          className="tracking-[0.05em]"
          hrefLang={otherLocale}
        >
          <span className={locale === "en" ? "opacity-100" : "opacity-40"}>
            {t("localeEn")}
          </span>
          <span className="mx-1 opacity-40">/</span>
          <span
            className={locale === "ur" ? "opacity-100" : "opacity-40"}
            lang="ur"
          >
            {t("localeUr")}
          </span>
        </Link>

        <span className="hidden sm:inline-flex" aria-hidden title={t("wishlist")}>
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M12 21s-7.2-4.6-9.6-9.2C.6 8.4 2.4 5 6 5c2.1 0 3.6 1.1 4.8 2.8C12 6.1 13.5 5 15.6 5c3.6 0 5.4 3.4 3.6 6.8C19.2 16.4 12 21 12 21z" />
          </svg>
        </span>

        <span className="hidden sm:inline-flex" aria-hidden title={t("search")}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </span>

        <Link
          href="/cart"
          className="relative inline-flex"
          aria-label={t("cart")}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
          >
            <path d="M6 8h12l-1.2 11.2a1.5 1.5 0 01-1.5 1.3H8.7a1.5 1.5 0 01-1.5-1.3L6 8z" />
            <path d="M9 8V6a3 3 0 016 0v2" />
          </svg>
          <span className="absolute -end-1.5 -top-1.5 inline-flex size-[15px] items-center justify-center bg-madder font-data text-[9px] leading-none text-greige">
            {cartCount}
          </span>
        </Link>
      </div>
    </header>
  );
}

export async function ShopFooter() {
  const t = await getTranslations("Footer");
  const brand = await getTranslations("Brand");
  const nav = await getTranslations("Nav");

  return (
    <footer className="bg-ink px-4 pb-8 pt-16 text-greige/80 md:px-10">
      <div className="mx-auto mb-12 grid max-w-[1400px] gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3.5">
            <AksWordmark
              name={brand("name")}
              nameUr={brand("nameUr")}
              invert
            />
          </div>
          <p className="max-w-[280px] text-[14px] leading-relaxed opacity-75">
            {brand("footerBlurb")}
          </p>
        </div>
        <div>
          <p className="mb-4 text-[12px] uppercase tracking-[0.1em] opacity-55">
            {t("shop")}
          </p>
          <div className="flex flex-col gap-2.5 text-[14px]">
            <Link href="/collections/new">{nav("new")}</Link>
            <Link href="/collections/formal">{nav("formal")}</Link>
            <Link href="/collections/fusion">{nav("fusion")}</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-[12px] uppercase tracking-[0.1em] opacity-55">
            {t("help")}
          </p>
          <div className="flex flex-col gap-2.5 text-[14px]">
            <Link href="/size-guide">{nav("sizeGuide")}</Link>
            <Link href="/track">{t("trackOrder")}</Link>
            <Link href="/shipping">{t("shipping")}</Link>
            <Link href="/returns">{t("returns")}</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-[12px] uppercase tracking-[0.1em] opacity-55">
            {t("talk")}
          </p>
          <a
            href={WHATSAPP}
            className="text-[14px] text-zari"
            rel="noreferrer"
            target="_blank"
          >
            {t("whatsappShahneela")}
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] border-t border-indigo-lift pt-5 text-[12px] opacity-55">
        {t("copyright")}
      </div>
    </footer>
  );
}

export function ShopFloatActions() {
  return (
    <div className="fixed bottom-7 end-6 z-50 flex flex-col gap-3">
      <a
        href={WHATSAPP}
        title="WhatsApp"
        className="inline-flex size-[52px] items-center justify-center bg-indigo text-greige"
        rel="noreferrer"
        target="_blank"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.11-1.33A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.2 14.2c-.22.62-1.28 1.18-1.77 1.24-.45.06-.98.09-3.02-.65-2.5-.9-4.15-3.32-4.28-3.48-.13-.16-1.02-1.36-1.02-2.6 0-1.23.65-1.84.88-2.09.22-.25.5-.3.66-.3l.47.01c.15 0 .35-.06.55.42.22.53.73 1.83.8 1.96.06.13.1.28.02.45-.08.17-.13.28-.26.43-.13.15-.27.34-.39.46-.13.13-.26.27-.11.53.15.27.68 1.12 1.46 1.81 1 .89 1.85 1.17 2.11 1.3.26.13.42.11.57-.07.16-.18.65-.76.83-1.02.18-.26.35-.21.6-.13.24.09 1.53.72 1.79.85.26.13.43.2.5.31.06.11.06.63-.16 1.25z" />
        </svg>
      </a>
      <a
        href={INSTAGRAM}
        title="Instagram"
        className="inline-flex size-[52px] items-center justify-center bg-ink text-greige"
        rel="noreferrer"
        target="_blank"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </a>
    </div>
  );
}
