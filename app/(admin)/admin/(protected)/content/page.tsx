import Link from "next/link";

import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { listContentPagesAdmin } from "@/modules/content/pages";
import { getOrCreateDraftHomepage, listCategoryTilesAdmin, listHeroSlidesAdmin } from "@/modules/content/homepage";
import { listDiscounts } from "@/modules/discounts";

export default async function ContentHubPage() {
  await requirePermission("content.view");

  const draft = await getOrCreateDraftHomepage();
  const [heroes, tiles, pages, discountRows] = await Promise.all([
    listHeroSlidesAdmin(draft.id),
    listCategoryTilesAdmin(draft.id),
    listContentPagesAdmin(),
    listDiscounts().catch(() => []),
  ]);

  const liveDiscounts = discountRows.filter(
    (d) => d.status === "ACTIVE" || d.status === "DRAFT",
  ).length;

  const cards = [
    {
      href: "/admin/content/homepage",
      title: "Homepage",
      description:
        "Welcome photos, gates, featured designs, section order.",
      count: `${heroes.length} photo${heroes.length === 1 ? "" : "s"} · ${tiles.length} gate${tiles.length === 1 ? "" : "s"}`,
    },
    {
      href: "/admin/content/pages",
      title: "Content pages",
      description: "Atelier, FAQ, shipping & returns, construction principles.",
      count: `${pages.length} page${pages.length === 1 ? "" : "s"}`,
    },
    {
      href: "/admin/content/nav",
      title: "Navigation",
      description: "Header and footer links shoppers use to move around.",
      count: "Header · footer",
    },
    {
      href: "/admin/content/lists",
      title: "Lists",
      description: "Construction signatures and other curated copy lists.",
      count: "Atelier lists",
    },
    {
      href: "/admin/content/settings",
      title: "Site settings",
      description: "Lead time, WhatsApp, socials, currency, brand name.",
      count: "6 fields",
    },
    {
      href: "/admin/discounts",
      title: "Discounts",
      description:
        "Codes and automatic sales — primary place to manage promos.",
      count: `${liveDiscounts} active or scheduled`,
    },
  ] as const;

  return (
    <div>
      <Eyebrow className="text-ink/55">Sell · Content & Settings</Eyebrow>
      <h1 className="mt-2 font-display text-[2.4rem] font-light leading-none text-ink">
        Content & Settings
      </h1>
      <p className="mt-2 max-w-xl text-[13.5px] text-ink/55">
        Everything a visitor sees that isn&apos;t a design or a fabric — edit
        here, publish, and the storefront updates.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border border-ink/12 bg-milk p-6 transition-colors hover:border-ink"
          >
            <div className="font-display text-[1.4rem] text-ink">{card.title}</div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink/55">
              {card.description}
            </p>
            <p className="mt-4 font-data text-[10.5px] text-zari">{card.count}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
