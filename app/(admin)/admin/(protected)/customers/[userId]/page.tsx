import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  PermissionDeniedError,
  UnauthenticatedError,
  userHasPermission,
} from "@/modules/auth";
import { CustomerDetailView } from "@/modules/customers/customer-detail-view";
import { getCustomerDetail } from "@/modules/customers/queries";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  let detail;
  try {
    detail = await getCustomerDetail(userId);
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
