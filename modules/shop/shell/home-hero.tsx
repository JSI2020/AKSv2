import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";

/**
 * Storefront hero — greige ground, ink type (brand chrome).
 * No gradients (project rule). Motion photography can replace the plane later.
 */
export async function ShopHomeHero() {
  const t = await getTranslations("Home");

  return (
    <section className="relative min-h-[560px] w-full overflow-hidden bg-greige md:h-[88vh]">
      <div className="absolute inset-0 border-b border-ink/10" aria-hidden />
      <div className="absolute bottom-14 start-0 z-10 max-w-[640px] px-6 text-ink md:start-12 md:px-0">
        <p
          className="mb-3.5 font-urdu text-[17px] italic tracking-[0.08em] text-ink/80"
          lang="ur"
        >
          {t("eyebrow")}
        </p>
        <h1 className="mb-[18px] font-display text-[clamp(38px,5.5vw,72px)] font-medium leading-[1.05]">
          {t("headlineLine1")}
          <br />
          {t("headlineLine2")}
        </h1>
        <p className="mb-7 max-w-[460px] text-[17px] leading-relaxed text-ink/85">
          {t("subhead")}
        </p>
        <Link
          href="/collections"
          className="inline-flex items-center gap-2.5 bg-ink px-[30px] py-3.5 font-display text-[12px] uppercase tracking-[0.12em] text-greige"
        >
          {t("cta")}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="rtl:rotate-180"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
