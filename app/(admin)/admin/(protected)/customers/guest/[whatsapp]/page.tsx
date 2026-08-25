import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  PermissionDeniedError,
  UnauthenticatedError,
  userHasPermission,
} from "@/modules/auth";
import { CustomerDetailView } from "@/modules/customers/customer-detail-view";
import { getGuestCustomerDetail } from "@/modules/customers/queries";

export default async function GuestCustomerDetailPage({
  params,
}: {
  params: Promise<{ whatsapp: string }>;
}) {
  const { whatsapp: raw } = await params;
  const whatsapp = decodeURIComponent(raw);

  let detail;
  try {
    detail = await getGuestCustomerDetail(whatsapp);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!detail) notFound();

  const session = await auth();
  const canEdit = session?.user?.id
    ? await userHasPermission(session.user.id, "customers.edit")
    : false;

  return <CustomerDetailView detail={detail} canEdit={canEdit} />;
}
