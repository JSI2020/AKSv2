import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Layers,
  LineChart,
  Palette,
  Percent,
  Scissors,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import type { PermissionKey } from "@aks/shared";

export type AdminNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** When set, item is shown only if `useCan(permission)` is true. */
  permission: PermissionKey | null;
  shortcut?: string;
};

/**
 * Primary admin navigation.
 * Visibility is UI-only — mutations still go through `requirePermission`.
 */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  {
    title: "Today",
    href: "/admin",
    icon: LayoutDashboard,
    permission: "orders.view",
    shortcut: "G T",
  },
  {
    title: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
    permission: "orders.view",
    shortcut: "G O",
  },
  {
    title: "Production",
    href: "/admin/production",
    icon: Scissors,
    permission: "production.view",
    shortcut: "G P",
  },
  {
    title: "Studio",
    href: "/admin/studio/new",
    icon: Sparkles,
    permission: "designs.create",
  },
  {
    title: "Designs",
    href: "/admin/designs",
    icon: Palette,
    permission: "designs.view",
    shortcut: "G D",
  },
  {
    title: "Fabric",
    href: "/admin/fabrics",
    icon: Layers,
    permission: "fabric.view",
    shortcut: "G F",
  },
  {
    title: "Customers",
    href: "/admin/customers",
    icon: Users,
    permission: "customers.view",
    shortcut: "G C",
  },
  {
    title: "Reflection",
    href: "/admin/tryon",
    icon: Sparkles,
    permission: "tryon.view",
  },
  {
    title: "Discounts",
    href: "/admin/discounts",
    icon: Percent,
    permission: "discounts.view",
  },
  {
    title: "Money",
    href: "/admin/money",
    icon: Wallet,
    permission: "money.view",
    shortcut: "G M",
  },
  {
    title: "Verify transfers",
    href: "/admin/payments/verification",
    icon: Wallet,
    permission: "money.verify_payments",
  },
  {
    title: "COD remittances",
    href: "/admin/payments/cod",
    icon: Wallet,
    permission: "money.manage_cod",
  },
  {
    title: "Insights",
    href: "/admin/insights",
    icon: LineChart,
    permission: "insights.view",
    shortcut: "G I",
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
    permission: "settings.view",
    shortcut: "G S",
  },
] as const;

export function breadcrumbForPath(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: "Admin", href: "/admin" },
  ];

  if (pathname === "/admin" || pathname === "/admin/") {
    crumbs.push({ label: "Today" });
    return crumbs;
  }

  const rest = pathname.replace(/^\/admin\/?/, "");
  if (!rest) {
    crumbs.push({ label: "Today" });
    return crumbs;
  }

  const segments = rest.split("/").filter(Boolean);
  let acc = "/admin";
  segments.forEach((seg, i) => {
    acc += `/${seg}`;
    const label = seg
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    if (i === segments.length - 1) {
      crumbs.push({ label });
    } else {
      crumbs.push({ label, href: acc });
    }
  });

  return crumbs;
}
