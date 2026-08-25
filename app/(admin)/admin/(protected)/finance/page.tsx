import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { AdminNuqsProvider } from "@/modules/admin";
import { resolveTimeRange } from "@/modules/admin/time-filter";
import { FinanceHub } from "@/modules/finance/admin/finance-hub";
import { getFinanceHubData } from "@/modules/finance/queries";
import { financeSearchParamsCache } from "@/modules/finance/search-params";
import { listRemittableCodOrders } from "@/modules/payments/cod/queries";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("money.view");
  const sp = await financeSearchParamsCache.parse(searchParams);
  const range = resolveTimeRange({
    preset: sp.range,
    fromKey: sp.from,
    toKey: sp.to,
  });

  const [data, remittableOrders] = await Promise.all([
    getFinanceHubData(range),
    listRemittableCodOrders().catch(() => []),
  ]);

  return (
    <AdminNuqsProvider>
      <div>
        <Eyebrow className="text-ink/55">Money · Payments & Finance</Eyebrow>
        <h1 className="mt-2 font-display text-[2.2rem] font-light leading-none text-ink">
          Payments & Finance
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] text-ink/55">
          Most orders here are paid by deposit + cash on delivery — this is built
          around that reality, not around cards.
        </p>
        <div className="mt-6">
          <FinanceHub data={{ ...data, remittableOrders }} />
        </div>
      </div>
    </AdminNuqsProvider>
  );
}
