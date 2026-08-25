import { requirePermission, userHasPermission } from "@/modules/auth";
import { AdminNuqsProvider } from "@/modules/admin";
import { resolveTimeRange } from "@/modules/admin/time-filter";
import { Eyebrow } from "@/modules/ui";

import { ProductionBoardClient } from "@/modules/production/admin/production-board-client";
import {
  productionBoardSearchParamsCache,
  searchParamsToProductionFilters,
} from "@/modules/production/admin/search-params";
import { listProductionBoard, listActiveStaff } from "@/modules/production/queries";
import { computeStaffWorkload } from "@/modules/production/workload";

import "@/modules/production/transitions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductionPage({ searchParams }: PageProps) {
  const session = await requirePermission("production.view");
  const params = productionBoardSearchParamsCache.parse(await searchParams);
  const filters = searchParamsToProductionFilters(params);
  const time = resolveTimeRange({
    preset: params.range,
    fromKey: params.from,
    toKey: params.to,
  });
  filters.dateFrom = time.from;
  filters.dateTo = time.to;

  const tailorOnly = await userHasPermission(session.user.id, "production.view");
  const hasOrders = await userHasPermission(session.user.id, "orders.view");
  const tailorSafe = tailorOnly && !hasOrders;

  const [columns, staff, workload] = await Promise.all([
    listProductionBoard(filters, { tailorSafe }),
    listActiveStaff(),
    computeStaffWorkload(),
  ]);

  return (
    <div>
      <Eyebrow>Workshop</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Production</h1>
      <p className="mt-1 max-w-prose text-[13px] text-chalk">
        Drag a card to the next column to advance. Touch-first — built for the
        workshop floor.
      </p>
      <div className="mt-6">
        <AdminNuqsProvider>
          <ProductionBoardClient
            columns={columns}
            staff={staff}
            workload={workload}
          />
        </AdminNuqsProvider>
      </div>
    </div>
  );
}
