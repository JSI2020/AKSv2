import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { listSizeBlocks } from "@/modules/sizing/block-actions";
import { getActiveGridWithRows, getStyleBundle, gridRowsToMeasurements } from "@/modules/dress-sizing/db/queries";
import { PomEditor } from "@/modules/dress-sizing/admin/PomEditor";
import { FitEventForm } from "@/modules/dress-sizing/admin/FitEventForm";
import { applyDressChartToSizeBlockAction, publishStyleAction } from "@/modules/dress-sizing/admin/actions";
export default async function StyleEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("settings.view");
  const { id } = await params;
  const [bundle, grid, blocks] = await Promise.all([getStyleBundle(db, id), getActiveGridWithRows(db), listSizeBlocks()]);
  if (!bundle || !grid) notFound();
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-3xl text-greige">{bundle.style.name}</h1><p className="text-[12px] text-chalk">{bundle.style.lengthBand} · {bundle.style.fitIntent}</p></div>
      <div className="flex gap-2"><Link className="border border-chalk/40 px-3 py-1 text-greige" href={`/admin/settings/sizing/chart/${id}`}>View chart</Link>{bundle.style.status === "draft" ? <form action={async () => { "use server"; await publishStyleAction(id); }}><button className="bg-zari px-3 py-1 text-ink">Publish</button></form> : null}</div>
    </header>
    <PomEditor kind="style" id={id} title="Fine-tune POMs" poms={bundle.poms} weights={bundle.fitWeights} grid={gridRowsToMeasurements(grid.rows)} baseSize={bundle.style.baseSize} />
    <form className="flex flex-wrap items-end gap-2 border border-indigo-lift p-3" action={async (formData) => { "use server"; await applyDressChartToSizeBlockAction({ styleId: id, sizeBlockId: String(formData.get("sizeBlockId")) }); }}>
      <label className="text-[12px] text-chalk">Apply to size block<select name="sizeBlockId" className="ms-2 border border-chalk/40 bg-indigo px-2 py-1 text-greige">{blocks.map((b) => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
      <button className="bg-zari px-3 py-1 text-ink">Apply pinned overrides</button>
    </form>
    <FitEventForm styleId={id} />
  </div>;
}
