import { asc, eq } from "drizzle-orm";

import { db, fabrics } from "@aks/db";

export type FabricLibraryRow = {
  id: string;
  name: string;
  composition: string;
  drapeNotes: string | null;
  careInstructions: string | null;
  drapeClass: string;
};

export async function listStorefrontFabrics(): Promise<FabricLibraryRow[]> {
  const rows = await db
    .select({
      id: fabrics.id,
      name: fabrics.name,
      composition: fabrics.composition,
      drapeNotes: fabrics.drapeNotes,
      careInstructions: fabrics.careInstructions,
      drapeClass: fabrics.drapeClass,
    })
    .from(fabrics)
    .where(eq(fabrics.active, true))
    .orderBy(asc(fabrics.name));

  return rows;
}
