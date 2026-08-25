import { notFound } from "next/navigation";
import { requirePermission } from "@/modules/auth";
import { db } from "@/packages/db/client";
import { getActiveGridWithRows, getProposal, gridRowsToMeasurements, listTemplates } from "@/modules/dress-sizing/db/queries";
import { ProposalReview } from "@/modules/dress-sizing/admin/ProposalReview";
export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("settings.view");
  const { id } = await params;
  const [proposal, templates, grid] = await Promise.all([getProposal(db, id), listTemplates(db), getActiveGridWithRows(db)]);
  if (!proposal || !grid) notFound();
  const raw = proposal.rawJson as { lowConfidence?: boolean };
  return <ProposalReview proposalId={id} imageUrl={proposal.imageUrl} confidence={proposal.confidence} lowConfidence={raw.lowConfidence === true} initialTemplateKey={proposal.templateKey} initialLengthBand={proposal.lengthBand} initialFitIntent={proposal.fitIntent} templates={templates} grid={gridRowsToMeasurements(grid.rows)} />;
}
