import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { getPermissionsForUser } from "@/modules/auth";
import { TodayScreen } from "@/modules/admin/today/today-screen";
import { isProductionOnlyRole } from "@/modules/auth/tailor-access";

export default async function AdminTodayPage() {
  const session = await auth();
  if (session?.user && isProductionOnlyRole(session.user.role)) {
    redirect("/admin/production");
  }

  const permissions = session?.user
    ? [...(await getPermissionsForUser(session.user.id))]
    : [];

  return <TodayScreen permissions={permissions} />;
}
