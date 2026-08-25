import { redirect } from "next/navigation";

import { AdminNuqsProvider } from "@/modules/admin";
import {
  resolveTimeRange,
  timeRangeSearchParamsCache,
} from "@/modules/admin/time-filter";
import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { InsightsDashboard } from "@/modules/insights/insights-dashboard";
import { getInsightsReportData } from "@/modules/insights/queries-reports";

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = timeRangeSearchParamsCache.parse(await searchParams);
  const time = resolveTimeRange({
    preset: params.range,
    fromKey: params.from,
    toKey: params.to,
  });

  let data;
  try {
    data = await getInsightsReportData({ from: time.from, to: time.to });
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
    <AdminNuqsProvider>
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
    </AdminNuqsProvider>
  );
}
