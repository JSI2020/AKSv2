import type { PermissionKey } from "@aks/shared";
import { PERMISSION_MODULES } from "@aks/shared";

export type PermissionCellState = "inherited" | "granted" | "denied";

export function cellStateFor(
  key: PermissionKey,
  overrides: ReadonlyArray<{ key: PermissionKey; effect: "GRANT" | "DENY" }>,
): PermissionCellState {
  const override = overrides.find((o) => o.key === key);
  if (override?.effect === "GRANT") return "granted";
  if (override?.effect === "DENY") return "denied";
  return "inherited";
}

export function inheritedGranted(
  key: PermissionKey,
  roleDefaults: ReadonlySet<PermissionKey>,
): boolean {
  return roleDefaults.has(key);
}

export { PERMISSION_MODULES };
