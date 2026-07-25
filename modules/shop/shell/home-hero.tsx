import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";

export async function ShopHomeHero() {
  const t = await getTranslations("Home");

  return (
    <section className="relative min-h-[560px] w-full overflow-hidden md:h-[88vh]">
      <div
        className="absolute inset-0 bg-gradient-to-b from-indigo via-indigo-lift to-ink"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent"
        aria-hidden
      />
      <div className="absolute bottom-14 start-0 z-10 max-w-[640px] px-6 text-greige md:start-12 md:px-0">
        <p
          className="mb-3.5 font-urdu text-[17px] italic tracking-[0.08em] opacity-90"
          lang="ur"
        >
          {t("eyebrow")}
        </p>
        <h1 className="mb-[18px] font-display text-[clamp(38px,5.5vw,72px)] font-medium leading-[1.05]">
          {t("headlineLine1")}
          <br />
          {t("headlineLine2")}
        </h1>
        <p className="mb-7 max-w-[460px] text-[17px] leading-relaxed opacity-92">
          {t("subhead")}
        </p>
        <Link
          href="/collections/new"
          className="inline-flex items-center gap-2.5 bg-greige px-[30px] py-3.5 font-display text-[12px] uppercase tracking-[0.12em] text-ink"
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
