import { eq } from "drizzle-orm";
import { uuidv7 } from "@aks/shared";
import type { Database } from "@/packages/db";
import { dressSizeGrid, dressSizeGridRow } from "@/packages/db/schema";
import { AKS_STANDARD_V1_NAME, aksStandardV1RowsHundredths } from "../core/body-grid";

export async function seedBodyGrid(db: Database): Promise<{ gridId: string; rowCount: number }> {
  const [existing] = await db.select().from(dressSizeGrid)
    .where(eq(dressSizeGrid.name, AKS_STANDARD_V1_NAME)).limit(1);
  await db.update(dressSizeGrid).set({ isActive: false });
  const gridId = existing?.id ?? uuidv7();
  if (existing) {
    await db.update(dressSizeGrid).set({ isActive: true }).where(eq(dressSizeGrid.id, gridId));
    await db.delete(dressSizeGridRow).where(eq(dressSizeGridRow.gridId, gridId));
  } else {
    await db.insert(dressSizeGrid).values({ id: gridId, name: AKS_STANDARD_V1_NAME, isActive: true });
  }
  const rows = aksStandardV1RowsHundredths().map((row) => ({ id: uuidv7(), gridId, ...row }));
  await db.insert(dressSizeGridRow).values(rows);
  return { gridId, rowCount: rows.length };
}
