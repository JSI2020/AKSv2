"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCan } from "@/modules/auth/use-can";
import { cn } from "@/lib/utils";

import { ADMIN_NAV_ITEMS, type AdminNavItem } from "../nav-config";

function NavLink({
  item,
  compact = false,
}: {
  item: AdminNavItem;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active =
    item.href === "/admin"
      ? pathname === "/admin" || pathname === "/admin/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 border border-transparent px-2 py-1.5 text-[13px] text-greige/80 transition-colors hover:bg-indigo-lift hover:text-greige",
        active && "border-zari/40 bg-indigo-lift text-greige",
        compact && "flex-col gap-0.5 px-1 py-1 text-[10px] uppercase tracking-[0.08em]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("size-4 shrink-0", compact && "size-4")} aria-hidden />
      <span className={cn(!compact && "truncate")}>{item.title}</span>
    </Link>
  );
}

function useVisibleNav(): AdminNavItem[] {
  // Hooks must be called unconditionally — check each known key.
  const canOrders = useCan("orders.view");
  const canDesigns = useCan("designs.view");
  const canFabric = useCan("fabric.view");
  const canCustomers = useCan("customers.view");
  const canMoney = useCan("money.view");
  const canVerifyPayments = useCan("money.verify_payments");
  const canManageCod = useCan("money.manage_cod");
  const canInsights = useCan("insights.view");
  const canSettings = useCan("settings.view");

  const map: Record<string, boolean> = {
    "orders.view": canOrders,
    "designs.view": canDesigns,
    "fabric.view": canFabric,
    "customers.view": canCustomers,
    "money.view": canMoney,
    "money.verify_payments": canVerifyPayments,
    "money.manage_cod": canManageCod,
    "insights.view": canInsights,
    "settings.view": canSettings,
  };

  return ADMIN_NAV_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return map[item.permission] === true;
  });
}

/** Fixed desktop sidebar rail. */
export function AdminSidebar({ email }: { email?: string | null }) {
  const items = useVisibleNav();

  return (
    <aside className="hidden min-h-dvh w-52 shrink-0 flex-col border-e border-indigo-lift bg-indigo md:flex">
      <div className="border-b border-indigo-lift px-3 py-4">
        <p className="font-display text-xl text-greige">AKS</p>
        <p className="mt-0.5 truncate font-sans text-[11px] text-chalk">
          {email ?? "admin"}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Admin">
        {items.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
      <p className="border-t border-indigo-lift px-3 py-2 font-sans text-[10px] uppercase tracking-[0.12em] text-chalk">
        ⌘K · jump
      </p>
    </aside>
  );
}

/** Mobile bottom bar — collapses the rail. */
export function AdminMobileNav() {
  const items = useVisibleNav();

  return (
    <nav
      className="fixed inset-inline-0 bottom-0 z-40 flex gap-0.5 overflow-x-auto border-t border-indigo-lift bg-indigo px-1 py-1 md:hidden"
      aria-label="Admin mobile"
    >
      {items.map((item) => (
        <div key={item.href} className="min-w-[4.25rem] flex-1">
          <NavLink item={item} compact />
        </div>
      ))}
    </nav>
  );
}

export { useVisibleNav };
