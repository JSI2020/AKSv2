import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listOrderMessages } from "@/modules/messaging/actions";
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

  const messages = await listOrderMessages(id);

  return <OrderDetailView order={order} messages={messages} />;
}
