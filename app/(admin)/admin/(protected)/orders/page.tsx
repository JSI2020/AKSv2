import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNuqsProvider } from "@/modules/admin";
import { resolveTimeRange } from "@/modules/admin/time-filter";
import { EmptyState, Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
  requirePermission,
} from "@/modules/auth";
import {
  getOrdersListOverview,
  listOrders,
  OrdersTable,
  orderListSearchParamsCache,
  searchParamsToOrderFilters,
  OPEN_PRODUCTION_STATUSES,
} from "@/modules/orders";
import { OrdersOverview } from "@/modules/orders/admin/orders-overview";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = orderListSearchParamsCache.parse(await searchParams);
  const filters = searchParamsToOrderFilters(params);
  const time = resolveTimeRange({
    preset: params.range,
    fromKey: params.from,
    toKey: params.to,
  });
  filters.dateFrom = time.from;
  filters.dateTo = time.to;

  // Default chip: All open (non-terminal pipeline)
  if (
    !params.view &&
    params.production.length === 0 &&
    params.payment.length === 0 &&
    !params.due &&
    !params.completedThisMonth &&
    !params.q
  ) {
    filters.productionStatus = [...OPEN_PRODUCTION_STATUSES];
  }

  let result;
  let overview;
  let canCreate = false;
  try {
    [result, overview] = await Promise.all([
      listOrders(filters),
      getOrdersListOverview(),
    ]);
    try {
      await requirePermission("orders.create");
      canCreate = true;
    } catch {
      canCreate = false;
    }
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  const hasFilters =
    Boolean(params.q) ||
    params.production.length > 0 ||
    params.payment.length > 0 ||
    Boolean(params.due) ||
    Boolean(params.completedThisMonth) ||
    Boolean(params.view);

  return (
    <AdminNuqsProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow className="text-ink/55">Sell</Eyebrow>
            <h1 className="mt-2 font-display text-[2.4rem] font-light leading-none text-ink">
              Orders
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] text-ink/55">
              Standard sizes XS–XXL · production and payment tracked separately.
            </p>
          </div>
          {canCreate ? (
            <Link
              href="/admin/orders/new"
              className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.1em] text-milk transition-colors hover:bg-madder"
            >
              + New manual order
            </Link>
          ) : null}
        </div>

        <OrdersOverview overview={overview} />

        {result.total === 0 && !hasFilters && overview.open === 0 ? (
          <EmptyState
            tone="on-greige"
            title="No orders yet"
            description="When a customer completes checkout, the order lands here — with its items, size, and payment state ready to work."
          />
        ) : (
          <OrdersTable result={result} overview={overview} />
        )}
      </div>
    </AdminNuqsProvider>
  );
}
