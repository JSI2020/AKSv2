/**
 * Permission catalogue and role presets (source of truth for seed + RBAC).
 * Format: `module.action` — see docs/AKS_Admin_Portal_Prompt.md §2.
 */

export const PERMISSION_MODULES = {
  orders: [
    "view",
    "create",
    "edit",
    "advance_status",
    "refund",
    "cancel",
    "delete",
  ],
  designs: ["view", "create", "edit", "publish", "delete"],
  fabric: ["view", "create", "edit", "adjust_stock", "delete"],
  customers: ["view", "edit", "export", "delete"],
  money: [
    "view",
    "edit_costs",
    "view_margin",
    "verify_payments",
    "manage_cod",
  ],
  insights: ["view"],
  settings: ["view", "edit", "edit_financial"],
  staff: ["view", "create", "edit", "assign_permissions", "deactivate"],
  production: ["view", "advance_stage", "assign"],
} as const;

type ModuleName = keyof typeof PERMISSION_MODULES;
type ActionOf<M extends ModuleName> = (typeof PERMISSION_MODULES)[M][number];

export type PermissionKey = {
  [M in ModuleName]: `${M}.${ActionOf<M>}`;
}[ModuleName];

export type StaffRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "STAFF"
  | "TAILOR"
  | "ACCOUNTANT"
  | "READ_ONLY";

function allKeys(): PermissionKey[] {
  const keys: PermissionKey[] = [];
  for (const [mod, actions] of Object.entries(PERMISSION_MODULES)) {
    for (const action of actions) {
      keys.push(`${mod}.${action}` as PermissionKey);
    }
  }
  return keys;
}

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = allKeys();

function viewsOnly(): PermissionKey[] {
  return ALL_PERMISSION_KEYS.filter((k) => k.endsWith(".view"));
}

/** Role → default permission keys (presets, not hard limits — overrides win). */
export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, readonly PermissionKey[]> =
  {
    OWNER: ALL_PERMISSION_KEYS,

    /** Everything except `settings.edit_financial`. Creating OWNER/ADMIN is app-enforced. */
    ADMIN: ALL_PERMISSION_KEYS.filter((k) => k !== "settings.edit_financial"),

    /** Orders/designs/fabric/customers/production — create & edit, no delete. No money. */
    MANAGER: [
      "orders.view",
      "orders.create",
      "orders.edit",
      "orders.advance_status",
      "designs.view",
      "designs.create",
      "designs.edit",
      "designs.publish",
      "fabric.view",
      "fabric.create",
      "fabric.edit",
      "fabric.adjust_stock",
      "customers.view",
      "customers.edit",
      "customers.export",
      "production.view",
      "production.advance_stage",
      "production.assign",
    ],

    /** Orders + production: view, edit, advance. No delete, money, settings. */
    STAFF: [
      "orders.view",
      "orders.edit",
      "orders.advance_status",
      "production.view",
      "production.advance_stage",
    ],

    /** Production board only. */
    TAILOR: [
      "production.view",
      "production.advance_stage",
      "production.assign",
    ],

    /** Money (full) + read-only everywhere else. */
    ACCOUNTANT: [
      ...viewsOnly().filter((k) => !k.startsWith("money.")),
      "money.view",
      "money.edit_costs",
      "money.view_margin",
      "money.verify_payments",
      "money.manage_cod",
    ],

    /** View everything, change nothing. */
    READ_ONLY: viewsOnly(),
  };

export function roleDefaultPermissions(role: string): ReadonlySet<PermissionKey> {
  if (role in ROLE_DEFAULT_PERMISSIONS) {
    return new Set(
      ROLE_DEFAULT_PERMISSIONS[role as StaffRole],
    );
  }
  return new Set();
}

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(value);
}

export function parsePermissionKey(key: PermissionKey): {
  module: string;
  action: string;
} {
  const dot = key.indexOf(".");
  return {
    module: key.slice(0, dot),
    action: key.slice(dot + 1),
  };
}
