import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getOrderDetail } from "@/modules/orders";
import { OrderPackingSlipView } from "@/modules/orders/admin/order-print-views";

export default async function OrderPackingSlipPage({
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
  return <OrderPackingSlipView order={order} />;
}
