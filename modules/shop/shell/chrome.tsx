import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";
import { listActiveAnnouncements } from "@/modules/content/announcements";
import { listActiveNav } from "@/modules/content/nav";
import { getSiteSettings } from "@/modules/content/site-settings";

import { AnnouncementTicker } from "./announcement-ticker";
import { AksBrandLogo } from "./aks-brand-logo";
import { FooterNewsletter } from "./footer-newsletter";
import { ShopHeaderClient } from "./shop-header";

const FOUR_DOORS = HOUSE_COLLECTIONS.filter((c) =>
  ["essentials", "tailored", "occasion", "signature"].includes(c.slug),
);

/** @deprecated Prototype C uses a single header — kept for import safety. */
export async function ShopUtilityBar() {
  return null;
}

/** @deprecated Prototype C uses a single header. */
export async function ShopMarquee() {
  return null;
}

/** @deprecated Prototype C floats removed. */
export function ShopFloatActions() {
  return null;
}

export async function ShopHeader() {
  const [settings, headerNav, announcements] = await Promise.all([
    getSiteSettings(),
    listActiveNav("HEADER"),
    listActiveAnnouncements(),
  ]);

  const tickerItems =
    announcements.length > 0
      ? announcements
      : settings.announcementFallback
        ? [
            {
              id: "fallback",
              message: settings.announcementFallback,
              href: null,
            },
          ]
        : [];

  return (
    <>
      <AnnouncementTicker items={tickerItems} />
      <ShopHeaderClient headerNav={headerNav} />
    </>
  );
}

export async function ShopFooter() {
  const t = await getTranslations("ShopShell");
  const [settings, footerNav] = await Promise.all([
    getSiteSettings(),
    listActiveNav("FOOTER"),
  ]);

  const shopLinks = footerNav.filter((n) => n.columnKey === "shop");
  const atelierLinks = footerNav.filter((n) => n.columnKey === "atelier");

  return (
    <footer className="shop-footer">
      <div className="foot">
        <div className="fbrand">
          <div className="fmark">
            <AksBrandLogo className="flogo" />
            <span className="ur">عکس</span>
          </div>
          <div className="ftag">{t("footerTag")}</div>
          <p>{t("footerBlurb")}</p>
        </div>

        <div>
          <h5>{t("footerShop")}</h5>
          <ul>
            {(shopLinks.length > 0
              ? shopLinks
              : FOUR_DOORS.map((c) => ({
                  id: c.slug,
                  label: c.navLabel,
                  href: `/collections/${c.slug}`,
                  columnKey: "shop",
                }))
            ).map((c) => (
              <li key={c.id}>
                <Link href={c.href as "/collections"}>{c.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5>{t("footerAtelier")}</h5>
          <ul>
            {(atelierLinks.length > 0
              ? atelierLinks
              : [
                  {
                    id: "1",
                    label: t("footerMadeToOrder"),
                    href: "/size-guide",
                  },
                  {
                    id: "2",
                    label: t("footerFabricLibrary"),
                    href: "/fabrics",
                  },
                  {
                    id: "3",
                    label: t("footerSizeFit"),
                    href: "/size-guide",
                  },
                  {
                    id: "4",
                    label: t("footerOurStory"),
                    href: "/pages/atelier",
                  },
                ]
            ).map((c) => (
              <li key={c.id}>
                <Link href={c.href as "/fabrics"}>{c.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5>{t("footerStayClose")}</h5>
          <p
            style={{
              color: "rgba(234,225,207,.55)",
              fontSize: "13.5px",
              marginBottom: ".6rem",
            }}
          >
            {t("footerNewsletterLead")}
          </p>
          {settings.newsletterEnabled ? <FooterNewsletter /> : null}
          {settings.whatsappUrl || settings.instagramUrl ? (
            <div className="social">
              {settings.whatsappUrl ? (
                <a
                  href={settings.whatsappUrl}
                  rel="noreferrer"
                  target="_blank"
                  aria-label={t("whatsapp")}
                >
                  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                    <use href="#ic-whatsapp" />
                  </svg>
                  {t("whatsapp")}
                </a>
              ) : null}
              {settings.instagramUrl ? (
                <a
                  href={settings.instagramUrl}
                  rel="noreferrer"
                  target="_blank"
                  aria-label={t("instagram")}
                >
                  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                    <use href="#ic-instagram" />
                  </svg>
                  {t("instagram")}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="foot-base">
        <span>{t("footerTagline")}</span>
        <span>{t("footerCopyright")}</span>
      </div>
    </footer>
  );
}
