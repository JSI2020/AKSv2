import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { fitEventReport } from "@/modules/dress-sizing/db/queries";
export default async function FitEventsPage() {
  await requirePermission("settings.view");
  const rows = await fitEventReport(db);
  return <section className="border border-indigo-lift p-3"><h1 className="font-display text-2xl text-greige">Fit events</h1><div className="mt-3 overflow-x-auto"><table className="w-full text-[12px] text-greige"><thead><tr><th className="text-start">Style</th><th>Size</th><th>Outcome</th><th>Reason</th><th>Count</th></tr></thead><tbody>{rows.map((r) => <tr className="border-t border-indigo-lift" key={`${r.styleId}-${r.size}-${r.outcome}-${r.reason}`}><td className="py-2">{r.styleName}</td><td className="text-center">{r.size}</td><td className="text-center">{r.outcome}</td><td className="text-center">{r.reason}</td><td className="text-center">{r.count}</td></tr>)}</tbody></table></div></section>;
}
