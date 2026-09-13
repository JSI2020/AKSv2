import { redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { StudioApp } from "@/modules/photoreal/admin/studio-app";
import { getPhotorealSettingsAction } from "@/modules/photoreal/actions";

export default async function AdminPhotorealPage() {
  try {
    const settings = await getPhotorealSettingsAction();
    if (!settings.ok) {
      redirect("/admin");
    }
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
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
      <StudioApp />
    </div>
  );
}
