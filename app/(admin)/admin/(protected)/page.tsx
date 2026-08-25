import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { getPermissionsForUser } from "@/modules/auth";
import { TodayScreen } from "@/modules/admin/today/today-screen";
import { isProductionOnlyRole } from "@/modules/auth/tailor-access";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user && isProductionOnlyRole(session.user.role)) {
    redirect("/admin/production");
  }

  const permissions = session?.user
    ? [...(await getPermissionsForUser(session.user.id))]
    : [];

  const params = await searchParams;
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;

  return <TodayScreen permissions={permissions} from={from} to={to} />;
}
