import { standardGarmentRows } from "../core/standard";
import { ChartTable } from "./ChartTable";

export function ReferenceChart() {
  return (
    <section className="space-y-3">
      <div><h2 className="font-display text-xl text-greige">Reference chart</h2><p className="text-[13px] text-chalk">The standard finished-garment starting point.</p></div>
      <ChartTable rows={standardGarmentRows()} />
    </section>
  );
}
