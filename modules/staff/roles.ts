import type { StaffRole } from "@aks/shared";

export const STAFF_ROLES: readonly StaffRole[] = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "STAFF",
  "TAILOR",
  "ACCOUNTANT",
  "READ_ONLY",
] as const;

export const INVITABLE_ROLES: readonly StaffRole[] = [
  "ADMIN",
  "MANAGER",
  "STAFF",
  "TAILOR",
  "ACCOUNTANT",
  "READ_ONLY",
] as const;

/** Roles whose default access can be edited (never OWNER — it always has all). */
export const EDITABLE_ROLES: readonly StaffRole[] = STAFF_ROLES.filter(
  (r) => r !== "OWNER",
);
