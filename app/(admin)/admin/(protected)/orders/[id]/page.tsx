import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getOrderDetail, OrderDetailView } from "@/modules/orders";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let order;
  try {
    order = await getOrderDetail(id);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/orders"
          className="font-sans text-[12px] text-chalk hover:text-zari"
        >
          ← All orders
        </Link>
        <Eyebrow>Orders</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {order.orderNumber}
        </h1>
      </div>
      <OrderDetailView order={order} />
    </div>
  );
}
