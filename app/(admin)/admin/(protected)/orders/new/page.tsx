import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { ManualOrderForm } from "@/modules/orders/admin/manual-order-form";
import { getManualOrderDesignOptions } from "@/modules/orders/manual/queries";

export default async function NewManualOrderPage() {
  let designs;
  try {
    const { requirePermission } = await import("@/modules/auth");
    await requirePermission("orders.create");
    designs = await getManualOrderDesignOptions();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin/orders");
    }
    throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Orders</Eyebrow>
          <h1 className="mt-1 font-display text-3xl text-greige">
            New manual order
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-chalk">
            Enter WhatsApp, Instagram, phone, or walk-in sales. Uses the same
            snapshots and production flow as web checkout.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="text-[13px] text-chalk hover:text-greige"
        >
          Back to orders
        </Link>
      </div>

      <ManualOrderForm designs={designs} />
    </div>
  );
}
