import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Eyebrow } from "@/modules/ui";
import {
  getPermissionsForUser,
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  DesignCostingPanel,
  getDesignCostingData,
} from "@/modules/money";
import { getDesign, getDesignFormOptions } from "@/modules/designs";
import { DesignEditor } from "@/modules/designs/design-editor";
import { DesignRelatedPanels, getDesignRelated } from "@/modules/insights";

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
  let related = null;
  try {
    [related] = await Promise.all([getDesignRelated(id)]);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      related = null;
    } else {
      throw e;
    }
  }

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
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Designs</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {detail.design.name}
        </h1>
        <p className="mt-1 font-data text-[12px] text-chalk">
          {detail.categoryKey}
        </p>
      </div>
      <DesignEditor detail={detail} options={options} />
      {canViewMoney && costingData ? (
        <DesignCostingPanel
          data={costingData}
          canViewMargin={canViewMargin}
          canEdit={canEditCosts}
        />
      ) : null}
      {related ? <DesignRelatedPanels data={related} /> : null}
    </div>
  );
}
