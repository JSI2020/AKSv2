import { db } from "@/packages/db/client";
import { getChartRows } from "../db/queries";
import { ChartTable } from "./ChartTable";
export async function SizeChart({ styleId }: { styleId: string }) {
  const rows = await getChartRows(db, styleId);
  return rows.length ? <ChartTable rows={rows} styleId={styleId} /> : <p className="text-[13px] text-chalk">No generated chart.</p>;
}
