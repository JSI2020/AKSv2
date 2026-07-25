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
