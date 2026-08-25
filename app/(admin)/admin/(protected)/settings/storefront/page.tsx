import Link from "next/link";

import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { listAnnouncementsAdmin } from "@/modules/content/announcements";
import { getSiteSettings } from "@/modules/content/site-settings";
import { AnnouncementsAdmin } from "@/modules/content/admin/announcements-admin";
import { SiteSettingsForm } from "@/modules/content/admin/site-settings-form";
import { listDiscounts } from "@/modules/discounts";
import { StorefrontDiscountsPanel } from "@/modules/discounts/admin/storefront-discounts-panel";

type Tab = "brand" | "ticker" | "discounts";

export default async function StorefrontSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission("content.view");
  const sp = await searchParams;
  const tab: Tab =
    sp.tab === "ticker" || sp.tab === "discounts" ? sp.tab : "brand";

  const [settings, announcements, discounts] = await Promise.all([
    getSiteSettings(),
    listAnnouncementsAdmin(),
    listDiscounts().catch(() => []),
  ]);

  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: "brand", label: "Brand & contact", href: "/admin/settings/storefront" },
    {
      id: "ticker",
      label: "Announcements",
      href: "/admin/settings/storefront?tab=ticker",
    },
    {
      id: "discounts",
      label: "Category discounts",
      href: "/admin/settings/storefront?tab=discounts",
    },
  ];

  return (
    <div>
      <Eyebrow className="text-ink/55">Create · Storefront</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-light text-ink">
        Storefront
      </h1>
      <p className="mt-2 max-w-xl text-[13.5px] text-ink/55">
        Ticker messages, automatic category or site-wide discounts, and brand
        contact. A discount set on a design always wins over these rules.
      </p>

      <nav className="mt-6 flex flex-wrap gap-0 border-b border-ink/12">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={
              tab === t.id
                ? "border-b-2 border-zari px-4 py-2 text-[13px] text-ink"
                : "px-4 py-2 text-[13px] text-ink/45 hover:text-ink"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "brand" ? (
        <div className="mt-6">
          <SiteSettingsForm initial={settings} />
        </div>
      ) : null}

      {tab === "ticker" ? (
        <div className="mt-6">
          <p className="mb-4 max-w-xl text-[13px] text-ink/55">
            Multiple active messages rotate in a modern ticker at the top of the
            shop. Schedule windows optional.
          </p>
          <AnnouncementsAdmin
            initial={announcements.map((r) => ({
              ...r,
              link: r.link as { type: string; value: string } | null,
            }))}
          />
        </div>
      ) : null}

      {tab === "discounts" ? (
        <div className="mt-6">
          <StorefrontDiscountsPanel rows={discounts} />
        </div>
      ) : null}
    </div>
  );
}
