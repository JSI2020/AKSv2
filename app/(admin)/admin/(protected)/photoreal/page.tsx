import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
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
    <div>
      <Eyebrow>Photoreal</Eyebrow>
      <StudioApp />
    </div>
  );
}
