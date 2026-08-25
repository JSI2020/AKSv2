import Link from "next/link";
import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { listProposals } from "@/modules/dress-sizing/db/queries";
import { RecognizeForm } from "@/modules/dress-sizing/admin/RecognizeForm";
export default async function RecognitionPage() {
  await requirePermission("settings.view");
  const rows = await listProposals(db);
  return <div className="space-y-4"><RecognizeForm /><section className="border border-indigo-lift p-3"><h2 className="font-display text-xl text-greige">Proposals</h2><ul className="mt-2 divide-y divide-indigo-lift">{rows.map((r) => <li key={r.id}><Link className="flex justify-between py-2 text-greige" href={`/admin/settings/sizing/chart/recognition/${r.id}`}><span>{r.templateKey} · {r.lengthBand}</span><span className="text-chalk">{r.status}</span></Link></li>)}</ul></section></div>;
}
