import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { getActiveGridWithRows } from "@/modules/dress-sizing/db/queries";
import { GridEditor } from "@/modules/dress-sizing/admin/GridEditor";
export default async function GridPage() {
  await requirePermission("settings.view");
  const grid = await getActiveGridWithRows(db);
  return grid ? <GridEditor rows={grid.rows} /> : <p className="text-chalk">No active grid. Run the dress-sizing seeds.</p>;
}
