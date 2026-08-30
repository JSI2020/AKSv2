import { eq } from "drizzle-orm";

import type { Database } from "@/packages/db";
import { dressSizeGrid, dressStyleTemplate } from "@/packages/db/schema";

import { seedBodyGrid } from "./seed-grid";
import { seedStyleTemplates } from "./seed-templates";

/** Idempotent — seeds body grid + style templates when missing. */
export async function ensureDressSizingSeeded(db: Database): Promise<void> {
  const [template] = await db
    .select({ id: dressStyleTemplate.id })
    .from(dressStyleTemplate)
    .limit(1);
  if (!template) {
    await seedStyleTemplates(db);
  }

  const [grid] = await db
    .select({ id: dressSizeGrid.id })
    .from(dressSizeGrid)
    .where(eq(dressSizeGrid.isActive, true))
    .limit(1);
  if (!grid) {
    await seedBodyGrid(db);
  }
}
