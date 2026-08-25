import Link from "next/link";
import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { UploadForm } from "@/modules/dress-sizing/admin/UploadForm";
import { ReferenceChart } from "@/modules/dress-sizing/storefront/ReferenceChart";
import { listRecentDesigns } from "@/modules/dress-sizing/storefront/recent-designs";
export default async function ChartHomePage() {
  await requirePermission("settings.view");
  const recent = await listRecentDesigns(db);
  return <div className="space-y-6">
    <header><p className="uppercase tracking-[0.12em] text-chalk">Settings · Sizing</p><h1 className="font-display text-3xl text-greige">Size chart tool</h1></header>
    <UploadForm /><ReferenceChart />
    <section className="border border-indigo-lift p-3"><h2 className="mb-2 font-display text-xl text-greige">Recent</h2>
      <ul className="divide-y divide-indigo-lift">{recent.map((s) => <li key={s.id}><Link className="block py-2 text-greige hover:bg-indigo-lift/40" href={`/admin/settings/sizing/chart/${s.id}`}>{s.name} · {s.status}</Link></li>)}</ul>
    </section>
  </div>;
}
