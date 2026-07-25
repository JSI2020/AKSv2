import { notFound } from "next/navigation";

import { requirePermission } from "@/modules/auth";
import { TailorSpecSheetView } from "@/modules/production/admin/tailor-spec-sheet";
import { getTailorSpecSheetForPrint } from "@/modules/production/spec-sheet";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function TailorSpecPage({ params }: PageProps) {
  await requirePermission("production.view");
  const { jobId } = await params;

  const sheet = await getTailorSpecSheetForPrint(jobId);
  if (!sheet) notFound();

  return (
    <div className="pb-8">
      <TailorSpecSheetView sheet={sheet} />
    </div>
  );
}
