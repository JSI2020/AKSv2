import { Eyebrow } from "@/modules/ui";
import { CodRemittancePanel } from "@/modules/payments/admin/cod-remittance-panel";
import {
  listCodRemittances,
  listOutstandingCodOrders,
  listRemittableCodOrders,
} from "@/modules/payments/cod/queries";

export default async function CodRemittancesPage() {
  const [remittances, remittableOrders, outstandingOrders] = await Promise.all([
    listCodRemittances(),
    listRemittableCodOrders(),
    listOutstandingCodOrders(),
  ]);

  return (
    <div>
      <Eyebrow>Payments</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">COD remittances</h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-chalk">
        Couriers remit days after delivery — match batches against delivered
        orders and flag discrepancies.
      </p>
      <div className="mt-6">
        <CodRemittancePanel
          remittances={remittances}
          remittableOrders={remittableOrders}
          outstandingOrders={outstandingOrders}
        />
      </div>
    </div>
  );
}
