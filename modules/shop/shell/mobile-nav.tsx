import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";

/** Compact primary nav for viewports below the desktop header nav. */
export async function ShopMobileNav() {
  const t = await getTranslations("Nav");

  const nav = [
    { href: "/collections/new" as const, label: t("new") },
    { href: "/collections/formal" as const, label: t("formal") },
    { href: "/collections/fusion" as const, label: t("fusion") },
    { href: "/fabrics" as const, label: t("fabrics") },
    { href: "/size-guide" as const, label: t("sizeGuide") },
  ];

  return (
    <nav
      className="flex gap-5 overflow-x-auto border-b border-greige-deep px-4 py-3 text-[13px] tracking-[0.02em] lg:hidden"
      aria-label="Primary mobile"
    >
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="shrink-0 border-b border-transparent pb-0.5 text-ink"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
