import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { getStyleBundle, getTemplateById } from "@/modules/dress-sizing/db/queries";
import { STANDARD_TEMPLATE_KEY } from "@/modules/dress-sizing/core/standard";
import { ChartTable } from "@/modules/dress-sizing/storefront/ChartTable";
import { ChangeTable } from "@/modules/dress-sizing/storefront/ChangeTable";
import { SizeFitModule } from "@/modules/dress-sizing/storefront/SizeFitModule";
import { Recommender } from "@/modules/dress-sizing/storefront/Recommender";
import { StyleGuessEditor } from "@/modules/dress-sizing/admin/StyleGuessEditor";
export default async function ChartPage({ params }: { params: Promise<{ styleId: string }> }) {
  await requirePermission("settings.view");
  const { styleId } = await params;
  const bundle = await getStyleBundle(db, styleId);
  if (!bundle) notFound();
  const template = bundle.style.templateId ? await getTemplateById(db, bundle.style.templateId) : null;
  return <div className="space-y-5">
    <header><p className="uppercase tracking-[0.12em] text-chalk">Generated chart</p><h1 className="font-display text-3xl text-greige">{bundle.style.name}</h1></header>
    <StyleGuessEditor styleId={styleId} templateKey={template?.key ?? STANDARD_TEMPLATE_KEY} lengthBand={bundle.style.lengthBand} fitIntent={bundle.style.fitIntent} />
    <Recommender styleId={styleId} styleName={bundle.style.name} />
    <SizeFitModule garmentType={template?.key ?? STANDARD_TEMPLATE_KEY} lengthBand={bundle.style.lengthBand} fitIntent={bundle.style.fitIntent} baseSize={bundle.style.baseSize} rows={bundle.chart} />
    <ChangeTable rows={bundle.chart} />
    <ChartTable rows={bundle.chart} styleId={styleId} baseSize={bundle.style.baseSize} />
  </div>;
}
