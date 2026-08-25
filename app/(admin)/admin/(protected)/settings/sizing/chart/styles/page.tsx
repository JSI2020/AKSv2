import Link from "next/link";
import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { listStyles } from "@/modules/dress-sizing/db/queries";
export default async function StylesPage() {
  await requirePermission("settings.view");
  const rows = await listStyles(db);
  return <section className="border border-indigo-lift p-3"><h1 className="font-display text-2xl text-greige">Styles</h1><ul className="mt-3 divide-y divide-indigo-lift">{rows.map((r) => <li key={r.id}><Link className="flex justify-between py-2 text-greige" href={`/admin/settings/sizing/chart/styles/${r.id}`}><span>{r.name}</span><span className="text-chalk">{r.status}</span></Link></li>)}</ul></section>;
}
