import { eq, sql } from "drizzle-orm";

import { db, designGenerations } from "@aks/db";

import { usdMicrosToPkrPaisa } from "./usd-pkr";

export async function aiCostMinorForDesign(designId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${designGenerations.costUsdMicros}), 0)::int`,
    })
    .from(designGenerations)
    .where(eq(designGenerations.designId, designId));
  return usdMicrosToPkrPaisa(row?.total ?? 0);
}
