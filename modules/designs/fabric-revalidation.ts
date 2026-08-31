import { eq } from "drizzle-orm";

import { colourways, db } from "@aks/db";
import { revalidateFabricStockPathsMany } from "@/modules/inventory/revalidate-fabric-paths";

function collectFabricIds(
  rows: { fabricId: string; pieceFabrics: Record<string, string> }[],
): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    ids.push(row.fabricId);
    for (const fabricId of Object.values(row.pieceFabrics ?? {})) {
      if (fabricId) ids.push(fabricId);
    }
  }
  return ids;
}

export async function revalidateFabricsForDesign(
  designId: string,
): Promise<void> {
  const rows = await db
    .select({
      fabricId: colourways.fabricId,
      pieceFabrics: colourways.pieceFabrics,
    })
    .from(colourways)
    .where(eq(colourways.designId, designId));
  revalidateFabricStockPathsMany(collectFabricIds(rows));
}

export function revalidateFabricsFromColourwayRows(
  rows: { fabricId: string; pieceFabrics?: Record<string, string> }[],
): void {
  revalidateFabricStockPathsMany(
    collectFabricIds(
      rows.map((r) => ({
        fabricId: r.fabricId,
        pieceFabrics: r.pieceFabrics ?? {},
      })),
    ),
  );
}
