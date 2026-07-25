import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { DiscountsDashboard, listDiscounts } from "@/modules/discounts";

export default async function AdminDiscountsPage() {
  let rows;
  try {
    rows = await listDiscounts();
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
      <Eyebrow>Discounts</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Discounts</h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-chalk">
        Server-side rules snapshotted onto each order — historical totals never
        recompute. Preview uses a PKR 30,000 sample cart.
      </p>
      <div className="mt-6">
        <DiscountsDashboard rows={rows} />
      </div>
    </div>
  );
}
