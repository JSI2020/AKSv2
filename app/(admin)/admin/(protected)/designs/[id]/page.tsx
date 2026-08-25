import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  getPermissionsForUser,
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getDesignCostingData } from "@/modules/money/queries";
import { getDesign, getDesignFormOptions } from "@/modules/designs";
import { DesignEditor } from "@/modules/designs/design-editor";

const TABS = [
  "Details",
  "Photos",
  "Sizing",
  "Costing",
  "Price",
  "Preview",
] as const;

export default async function DesignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const initialTab = TABS.includes(sp.tab as (typeof TABS)[number])
    ? (sp.tab as (typeof TABS)[number])
    : "Details";

  let detail;
  let options;
  try {
    [detail, options] = await Promise.all([
      getDesign(id),
      getDesignFormOptions(),
    ]);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!detail) redirect("/admin/designs");

  const session = await auth();
  const permissions = session?.user?.id
    ? await getPermissionsForUser(session.user.id)
    : new Set<string>();

  const canViewMoney = permissions.has("money.view");
  const canViewMargin = permissions.has("money.view_margin");
  const canEditCosts = permissions.has("money.edit_costs");

  let costingData = null;
  if (canViewMoney) {
    try {
      costingData = await getDesignCostingData(id);
    } catch (e) {
      if (
        e instanceof PermissionDeniedError ||
        e instanceof UnauthenticatedError
      ) {
        costingData = null;
      } else {
        throw e;
      }
    }
  }

  return (
    <DesignEditor
      detail={detail}
      options={options}
      costing={costingData}
      canViewMargin={canViewMargin}
      canEditCosts={canEditCosts}
      initialTab={initialTab}
    />
  );
}
