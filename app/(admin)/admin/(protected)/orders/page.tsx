import { redirect } from "next/navigation";

import { AdminNuqsProvider } from "@/modules/admin";
import { EmptyState, Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  listOrders,
  OrdersTable,
  orderListSearchParamsCache,
  searchParamsToOrderFilters,
} from "@/modules/orders";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = orderListSearchParamsCache.parse(await searchParams);
  const filters = searchParamsToOrderFilters(params);

  let result;
  try {
    result = await listOrders(filters);
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
      <div className="flex flex-col gap-6">
        <div>
          <Eyebrow>Orders</Eyebrow>
          <h1 className="mt-1 font-display text-3xl text-greige">Orders</h1>
          <p className="mt-1 max-w-xl text-[13px] text-chalk">
            Production and payment status are tracked separately on every order.
          </p>
        </div>

        {result.total === 0 && !params.q && params.production.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="When a guest completes checkout, the order will appear here with its measurement snapshot frozen."
          />
        ) : (
          <OrdersTable result={result} />
        )}
      </div>
    </AdminNuqsProvider>
  );
}
