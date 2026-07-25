"use server";

import { requirePermission } from "./rbac";

/**
 * Sample destructive mutation used to prove server-side RBAC.
 * MANAGER (and similar) roles lack `orders.delete` — calling this
 * must throw even if the UI were bypassed.
 */
export async function deleteSomethingAction(): Promise<{ ok: true }> {
  await requirePermission("orders.delete");
  return { ok: true };
}
