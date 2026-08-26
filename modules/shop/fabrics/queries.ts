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

  // The catalogue can hold several stock rows of the same cloth (one per
  // supplier/lot); the storefront shows one card per fabric name.
  const seen = new Set<string>();
  const unique: FabricLibraryRow[] = [];
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique;
}

/**
 * Fabrics for the homepage teaser section — real, admin-managed rows
 * (active fabrics from the Fabric library), de-duplicated by name and
 * capped. Admin controls this by creating / activating fabrics in
 * /admin/fabrics; nothing here is hardcoded.
 */
export async function listFeaturedFabrics(
  limit = 4,
): Promise<FabricLibraryRow[]> {
  const all = await listStorefrontFabrics();
  const seen = new Set<string>();
  const featured: FabricLibraryRow[] = [];
  for (const f of all) {
    const key = f.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    featured.push(f);
    if (featured.length >= limit) break;
  }
  return featured;
}
