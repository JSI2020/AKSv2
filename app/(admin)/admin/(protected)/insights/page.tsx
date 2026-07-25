import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getInsightsReportData, InsightsDashboard } from "@/modules/insights";

export default async function AdminInsightsPage() {
  let data;
  try {
    data = await getInsightsReportData();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  return (
    <div>
      <Eyebrow>Insights</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Insights</h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-chalk">
        Derived reports from real orders — filterable, exportable, every row
        links to its entity.
      </p>
      <div className="mt-6">
        <InsightsDashboard data={data} />
      </div>
    </div>
  );
}
