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
      <Eyebrow>Money</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">AI spend & budget</h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-chalk">
        Live prepaid balances on fal.ai and DeepSeek, plus what AKS has spent
        this month against your monthly cap. Reflection (virtual try-on) runs
        the face-swap model; its quotas, selfie purge, and cache controls live
        below.
      </p>
      <div className="mt-6">
        <TryOnAdminDashboard initial={dashboard} pendingSelfies={pendingSelfies} />
      </div>
    </div>
  );
}
