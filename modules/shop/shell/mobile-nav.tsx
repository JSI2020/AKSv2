import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";

/** Compact primary nav for viewports below the desktop header nav. */
export async function ShopMobileNav() {
  const t = await getTranslations("Nav");

  const nav = [
    { href: "/collections/essentials" as const, label: t("essentials") },
    { href: "/collections/tailored" as const, label: t("tailored") },
    { href: "/collections/occasion" as const, label: t("occasion") },
    { href: "/collections/signature" as const, label: t("signature") },
    { href: "/collections/separates" as const, label: t("separates") },
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
