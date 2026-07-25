"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { PermissionKey } from "@aks/shared";

const PermissionsContext = createContext<ReadonlySet<string>>(new Set());

/**
 * Provide server-resolved permission keys to client UI.
 * Wire this from a server layout after `getPermissionsForUser`.
 */
export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={new Set(permissions)}>
      {children}
    </PermissionsContext.Provider>
  );
}

/** UI courtesy check — never a substitute for `requirePermission` on the server. */
export function useCan(key: PermissionKey): boolean {
  return useContext(PermissionsContext).has(key);
}
