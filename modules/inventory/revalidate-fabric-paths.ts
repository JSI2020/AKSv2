import { revalidatePath } from "next/cache";

/** Keep fabric admin + inventory + storefront views in sync after stock/master changes. */
export function revalidateFabricStockPaths(fabricId?: string): void {
  revalidatePath("/admin/fabrics");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/fabrics");
  revalidatePath("/admin");
  // Storefront fabric library + homepage teaser
  revalidatePath("/");
  revalidatePath("/fabrics");
  if (fabricId) {
    revalidatePath(`/admin/fabrics/${fabricId}`);
    revalidatePath(`/admin/inventory/fabrics/${fabricId}`);
  }
}

/** After design colourway fabric links change — refresh hub + each fabric detail. */
export function revalidateFabricStockPathsMany(fabricIds: string[]): void {
  revalidateFabricStockPaths();
  for (const id of new Set(fabricIds.filter(Boolean))) {
    revalidatePath(`/admin/fabrics/${id}`);
    revalidatePath(`/admin/inventory/fabrics/${id}`);
  }
}
