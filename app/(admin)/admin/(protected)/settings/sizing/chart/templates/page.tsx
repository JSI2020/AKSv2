import Link from "next/link";
import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { listTemplates } from "@/modules/dress-sizing/db/queries";
import { GARMENT_LABELS } from "@/modules/dress-sizing/ui/labels";
export default async function TemplatesPage() {
  await requirePermission("settings.view");
  const rows = await listTemplates(db);
  return <section className="border border-indigo-lift p-3"><h1 className="font-display text-2xl text-greige">Templates</h1><ul className="mt-3 divide-y divide-indigo-lift">{rows.map((r) => <li key={r.id}><Link className="block py-2 text-greige" href={`/admin/settings/sizing/chart/templates/${r.id}`}>{GARMENT_LABELS[r.key]}</Link></li>)}</ul></section>;
}
