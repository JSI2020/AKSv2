import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { TryOnAdminDashboard } from "@/modules/tryon/admin-dashboard";
import {
  getTryOnAdminDashboard,
  listPendingSelfies,
} from "@/modules/tryon/queries";

export default async function AdminTryOnPage() {
  let dashboard;
  let pendingSelfies;
  try {
    dashboard = await getTryOnAdminDashboard();
    pendingSelfies = await listPendingSelfies();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  return (
    <div>
      <Eyebrow>Reflection</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Try-on</h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-chalk">
        Session logs, consent records, selfie purge status, cache management,
        quotas, and AI spend vs cap. Storefront stays shoppable when Reflection
        is resting.
      </p>
      <div className="mt-6">
        <TryOnAdminDashboard initial={dashboard} pendingSelfies={pendingSelfies} />
      </div>
    </div>
  );
}
