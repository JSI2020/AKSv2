"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCan } from "@/modules/auth/use-can";
import { cn } from "@/lib/utils";
import { AksLogoImage } from "@/modules/shop/shell/brand";

import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  ADMIN_SETTINGS_SHORTCUTS,
  type AdminNavGroup,
  type AdminNavGroupId,
  type AdminNavItem,
} from "../nav-config";

function itemIsActive(pathname: string, item: AdminNavItem): boolean {
  if (item.href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/";
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  compact = false,
}: {
  item: AdminNavItem;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const Icon = item.icon;
  // Pathname can disagree between SSR and the first client paint (soft nav /
  // Turbopack). Keep active styling off until mounted so HTML matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const active = mounted && itemIsActive(pathname, item);

  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-[2px] px-3 py-2 text-[13.5px] text-greige/70 transition-colors hover:bg-indigo-lift hover:text-greige",
        active && "bg-indigo-lift text-greige",
        active &&
          "before:absolute before:inset-y-[calc(50%-9px)] before:start-0 before:w-[3px] before:bg-zari",
        compact &&
          "flex-col gap-0.5 px-1 py-1 text-[10px] uppercase tracking-[0.08em] before:hidden",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("size-4 shrink-0 opacity-85", compact && "size-4")} aria-hidden />
      <span className={cn(!compact && "truncate")}>{item.title}</span>
    </Link>
  );
}

function usePermissionMap(): Record<string, boolean> {
  const canOrders = useCan("orders.view");
  const canProduction = useCan("production.view");
  const canInventory = useCan("inventory.view");
  const canDesignsCreate = useCan("designs.create");
  const canPhotoreal = useCan("photoreal.view");
  const canDesigns = useCan("designs.view");
  const canFabric = useCan("fabric.view");
  const canCustomers = useCan("customers.view");
  const canTryon = useCan("tryon.view");
  const canDiscounts = useCan("discounts.view");
  const canContent = useCan("content.view");
  const canMoney = useCan("money.view");
  const canVerifyPayments = useCan("money.verify_payments");
  const canManageCod = useCan("money.manage_cod");
  const canInsights = useCan("insights.view");
  const canSettings = useCan("settings.view");

  return {
    "orders.view": canOrders,
    "production.view": canProduction,
    "inventory.view": canInventory,
    "designs.create": canDesignsCreate,
    "photoreal.view": canPhotoreal,
    "designs.view": canDesigns,
    "fabric.view": canFabric,
    "customers.view": canCustomers,
    "tryon.view": canTryon,
    "discounts.view": canDiscounts,
    "content.view": canContent,
    "money.view": canMoney,
    "money.verify_payments": canVerifyPayments,
    "money.manage_cod": canManageCod,
    "insights.view": canInsights,
    "settings.view": canSettings,
  };
}

function filterItems(
  items: readonly AdminNavItem[],
  map: Record<string, boolean>,
): AdminNavItem[] {
  return items.filter((item) => {
    if (!item.permission) return true;
    return map[item.permission] === true;
  });
}

function useVisibleNav(): AdminNavItem[] {
  const map = usePermissionMap();
  return filterItems(ADMIN_NAV_ITEMS, map);
}

function useVisibleGroups(): AdminNavGroup[] {
  const map = usePermissionMap();
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: filterItems(group.items, map),
  })).filter((g) => g.items.length > 0);
}

/** Fixed desktop sidebar rail — grouped per Admin Redesign. */
export function AdminSidebar({ email }: { email?: string | null }) {
  const groups = useVisibleGroups();
  const main = useMemo(() => groups.filter((g) => !g.foot), [groups]);
  const foot = useMemo(() => groups.filter((g) => g.foot), [groups]);

  const [collapsed, setCollapsed] = useState<
    Partial<Record<AdminNavGroupId, boolean>>
  >({});

  return (
    <aside className="hidden min-h-dvh w-[236px] shrink-0 flex-col bg-indigo lg:flex">
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/admin" className="inline-block leading-none" aria-label="AKS admin">
          <AksLogoImage size="admin" priority />
        </Link>
        <p className="mt-2 truncate font-sans text-[11px] text-greige/40">
          {email ?? "admin"}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-3" aria-label="Admin">
        {main.map((group) => {
          const isCollapsed = Boolean(group.label && collapsed[group.id]);
          return (
            <div key={group.id} className="mt-2 first:mt-1">
              {group.label ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 font-sans text-[9.5px] uppercase tracking-[0.2em] text-greige/40"
                  onClick={() =>
                    setCollapsed((c) => ({
                      ...c,
                      [group.id]: !c[group.id],
                    }))
                  }
                  aria-expanded={!isCollapsed}
                >
                  {group.label}
                  <span
                    className={cn(
                      "text-[8px] opacity-60 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
              ) : null}
              {!isCollapsed ? (
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-2.5">
        {foot.map((group) =>
          group.items.map((item) => (
            <NavLink key={item.href} item={item} />
          )),
        )}
        <p className="mt-1 px-3 py-1 font-sans text-[10px] uppercase tracking-[0.12em] text-greige/40">
          ⌘K · jump
        </p>
      </div>
    </aside>
  );
}

/** Full-screen phone and tablet menu. Every permitted section is listed. */
export function AdminMobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const groups = useVisibleGroups();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const skipClose = useRef(true);
  useEffect(() => {
    if (skipClose.current) {
      skipClose.current = false;
      return;
    }
    onClose();
  }, [pathname, onClose]);

  if (!open) return null;

  return (
    <div
      className="admin-menu fixed inset-0 z-50 flex flex-col bg-indigo text-greige lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Admin menu"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-greige/70">
          Menu
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-11 items-center justify-center border border-white/15 text-greige"
          aria-label="Close menu"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Admin">
        {groups.map((group) => (
          <div key={group.id} className="mt-3 first:mt-0">
            {group.label ? (
              <p className="px-3 py-1 font-sans text-[10px] uppercase tracking-[0.2em] text-greige/40">
                {group.label}
              </p>
            ) : null}
            <div className="flex flex-col">
              {group.items.map((item) => (
                <MobileNavLink key={item.href} item={item} />
              ))}
              {group.id === "settings"
                ? ADMIN_SETTINGS_SHORTCUTS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex min-h-11 items-center px-3 ps-9 text-[14px] text-greige/80"
                    >
                      {link.title}
                    </Link>
                  ))
                : null}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

function MobileNavLink({ item }: { item: AdminNavItem }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = itemIsActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 px-3 text-[15px] text-greige/85",
        active && "bg-indigo-lift text-greige",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{item.title}</span>
    </Link>
  );
}

export { useVisibleNav };
