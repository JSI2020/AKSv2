import type { LucideIcon } from "lucide-react";
import {
  Camera,
  FileText,
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

/** Grouped rail — matches docs/AKS_Admin_Redesign.html (16 → 5 groups). */
export type AdminNavGroupId =
  | "today"
  | "sell"
  | "make"
  | "create"
  | "money"
  | "settings";

export type AdminNavGroup = {
  id: AdminNavGroupId;
  /** Omit label for top Overview item. */
  label: string | null;
  /** Settings lives in the rail foot. */
  foot?: boolean;
  items: readonly AdminNavItem[];
};

/**
 * Primary admin navigation (flat list — still used by ⌘K).
 * Visibility is UI-only — mutations still go through `requirePermission`.
 */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  {
    title: "Overview",
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
    title: "Customers",
    href: "/admin/customers",
    icon: Users,
    permission: "customers.view",
    shortcut: "G C",
  },
  {
    title: "Discounts",
    href: "/admin/discounts",
    icon: Percent,
    permission: "discounts.view",
  },
  {
    title: "Production",
    href: "/admin/production",
    icon: Scissors,
    permission: "production.view",
    shortcut: "G P",
  },
  {
    title: "Fabric",
    href: "/admin/fabrics",
    icon: Layers,
    permission: "fabric.view",
    shortcut: "G F",
  },
  {
    title: "Studio",
    href: "/admin/studio",
    icon: Sparkles,
    permission: "designs.create",
  },
  {
    title: "Photoreal",
    href: "/admin/photoreal",
    icon: Camera,
    permission: "photoreal.view",
  },
  {
    title: "Designs",
    href: "/admin/designs",
    icon: Palette,
    permission: "designs.view",
    shortcut: "G D",
  },
  {
    title: "Content",
    href: "/admin/content",
    icon: FileText,
    permission: "content.view",
  },
  {
    title: "Reflection",
    href: "/admin/tryon",
    icon: Sparkles,
    permission: "tryon.view",
  },
  {
    title: "Payments",
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

export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "today",
    label: null,
    items: ADMIN_NAV_ITEMS.filter((i) => i.href === "/admin"),
  },
  {
    id: "sell",
    label: "Sell",
    items: ADMIN_NAV_ITEMS.filter((i) =>
      ["/admin/orders", "/admin/customers", "/admin/discounts"].includes(i.href),
    ),
  },
  {
    id: "make",
    label: "Make",
    items: ADMIN_NAV_ITEMS.filter((i) =>
      ["/admin/production", "/admin/fabrics"].includes(i.href),
    ),
  },
  {
    id: "create",
    label: "Create",
    items: ADMIN_NAV_ITEMS.filter((i) =>
      [
        "/admin/studio",
        "/admin/photoreal",
        "/admin/designs",
        "/admin/content",
        "/admin/tryon",
      ].includes(i.href),
    ),
  },
  {
    id: "money",
    label: "Money",
    items: ADMIN_NAV_ITEMS.filter((i) =>
      [
        "/admin/money",
        "/admin/payments/verification",
        "/admin/payments/cod",
        "/admin/insights",
      ].includes(i.href),
    ),
  },
  {
    id: "settings",
    label: "Settings",
    foot: true,
    items: ADMIN_NAV_ITEMS.filter((i) => i.href === "/admin/settings"),
  },
] as const;

/** Intermediate paths that have no page — crumbs stay labels only (no 404 links). */
const BREADCRUMB_HREF_DENY = new Set([
  "/admin/payments",
  "/admin/settings/sizing",
]);

const BREADCRUMB_LABELS: Record<string, string> = {
  studio: "Studio",
  photoreal: "Photoreal",
  tryon: "Reflection",
  fabrics: "Fabric",
  cod: "COD remittances",
  verification: "Verify transfers",
  ai: "AI brief",
  new: "New",
};

export function breadcrumbForPath(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: "Admin", href: "/admin" },
  ];

  if (pathname === "/admin" || pathname === "/admin/") {
    crumbs.push({ label: "Overview" });
    return crumbs;
  }

  const rest = pathname.replace(/^\/admin\/?/, "");
  if (!rest) {
    crumbs.push({ label: "Overview" });
    return crumbs;
  }

  const segments = rest.split("/").filter(Boolean);
  let acc = "/admin";
  segments.forEach((seg, i) => {
    acc += `/${seg}`;
    const label =
      BREADCRUMB_LABELS[seg] ??
      seg
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    const isLast = i === segments.length - 1;
    const hrefAllowed = !isLast && !BREADCRUMB_HREF_DENY.has(acc);
    crumbs.push(hrefAllowed ? { label, href: acc } : { label });
  });

  return crumbs;
}
