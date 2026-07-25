import { desc, sql } from "drizzle-orm";

import { orders } from "@aks/db";

import type { DbTx } from "@/modules/platform/types";

export async function generateOrderNumber(tx: DbTx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AKS-${year}-`;

  const rows = await tx
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(sql`${orders.orderNumber} like ${prefix + "%"}`)
    .orderBy(desc(orders.orderNumber))
    .limit(1);

  const last = rows[0]?.orderNumber;
  const seq = last ? Number.parseInt(last.split("-")[2] ?? "0", 10) + 1 : 1;

  return `${prefix}${String(seq).padStart(5, "0")}`;
}
