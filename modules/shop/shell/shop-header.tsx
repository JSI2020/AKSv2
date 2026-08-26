"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/routing";
import { CartHeaderButton } from "@/modules/cart/cart-header-button";
import type { NavItemPublic } from "@/modules/content/types";

import { AksStoreBrandLink } from "./brand";

function isHomePath(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}

function NavHref({
  item,
  onHome,
  onClick,
}: {
  item: NavItemPublic;
  onHome: boolean;
  onClick?: () => void;
}) {
  const href = item.href;
  if (href.startsWith("#")) {
    if (onHome) {
      return (
        <a href={href} onClick={onClick}>
          {item.label}
        </a>
      );
    }
    return (
      <Link href={`/${href}` as "/"} onClick={onClick}>
        {item.label}
      </Link>
    );
  }
  if (href.startsWith("http")) {
    return (
      <a href={href} rel="noreferrer" target="_blank" onClick={onClick}>
        {item.label}
      </a>
    );
  }
  return (
    <Link href={href as "/collections"} onClick={onClick}>
      {item.label}
    </Link>
  );
}

export function ShopHeaderClient({
  headerNav,
}: {
  headerNav: NavItemPublic[];
  /** @deprecated Official logo replaces text wordmark. */
  brandName?: string;
  /** @deprecated Official logo replaces text wordmark. */
  brandNameUr?: string;
}) {
  const t = useTranslations("ShopShell");
  const pathname = usePathname();
  const onHome = isHomePath(pathname);
  // Always start solid so SSR and first client paint match (avoids hydration error).
  // On the home hero we switch to on-hero after mount via scroll.
  // Hash vs route nav also waits for mount — usePathname can disagree with SSR
  // for one frame under localePrefix routing.
  const [solid, setSolid] = useState(true);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const homeNav = ready && onHome;

  useEffect(() => {
    setReady(true);
    if (!onHome) {
      setSolid(true);
      return;
    }

    const onScroll = () => {
      const hero = document.querySelector(".hero");
      const threshold = hero
        ? Math.max(0, (hero as HTMLElement).offsetHeight - 90)
        : 120;
      setSolid(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onHome]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const headerClass = [
    "shop-header",
    solid || !onHome || !ready ? "solid" : "",
    ready && onHome && !solid ? "on-hero" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // SSR + first client paint: always use route Links (stable).
  // After mount on home: switch hash anchors for in-page jumps.
  const fallbackLeft = homeNav ? (
    <>
      <a href="#cats">{t("navShop")}</a>
      <a href="#edit">{t("navEdit")}</a>
      <Link href="/fabrics">{t("navFabric")}</Link>
      <a href="#making">{t("navAtelier")}</a>
    </>
  ) : (
    <>
      <Link href="/collections">{t("navShop")}</Link>
      <Link href="/collections">{t("navEdit")}</Link>
      <Link href="/fabrics">{t("navFabric")}</Link>
      <Link href="/#making">{t("navAtelier")}</Link>
    </>
  );

  return (
    <header className={headerClass}>
      <nav className="nav" aria-label="Primary">
        <button
          type="button"
          className="burger"
          aria-expanded={menuOpen}
          aria-label={t("menu")}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>

        <div className="nav-left">
          {headerNav.length > 0
            ? headerNav.map((item) => (
                <NavHref key={item.id} item={item} onHome={homeNav} />
              ))
            : fallbackLeft}
        </div>

        <AksStoreBrandLink />

        <div className="nav-right">
          <Link href="/collections" className="icobtn" aria-label={t("search")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="#ic-search" />
            </svg>
          </Link>
          <Link
            href="/account/orders"
            className="icobtn"
            aria-label={t("account")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="#ic-account" />
            </svg>
          </Link>
          <CartHeaderButton label={t("bag")} iconMode />
        </div>
      </nav>

      <div className={`nav-mobile${menuOpen ? " open" : ""}`}>
        {headerNav.length > 0
          ? headerNav.map((item) => (
              <NavHref
                key={item.id}
                item={item}
                onHome={homeNav}
                onClick={() => setMenuOpen(false)}
              />
            ))
          : null}
        <Link href="/collections" onClick={() => setMenuOpen(false)}>
          {t("search")}
        </Link>
        <Link href="/account/orders" onClick={() => setMenuOpen(false)}>
          {t("account")}
        </Link>
      </div>
    </header>
  );
}
