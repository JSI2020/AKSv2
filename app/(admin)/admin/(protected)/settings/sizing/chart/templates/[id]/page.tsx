import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { getActiveGridWithRows, getTemplateById, gridRowsToMeasurements } from "@/modules/dress-sizing/db/queries";
import { PomEditor } from "@/modules/dress-sizing/admin/PomEditor";
import { GARMENT_LABELS } from "@/modules/dress-sizing/ui/labels";
export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("settings.view");
  const { id } = await params;
  const [template, grid] = await Promise.all([getTemplateById(db, id), getActiveGridWithRows(db)]);
  if (!template || !grid) notFound();
  return <PomEditor kind="template" id={id} title={GARMENT_LABELS[template.key]} poms={template.poms} weights={template.fitWeights} grid={gridRowsToMeasurements(grid.rows)} baseSize={template.baseSize} />;
}
