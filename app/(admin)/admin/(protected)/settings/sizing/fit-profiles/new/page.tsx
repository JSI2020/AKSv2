import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listGarmentCategories } from "@/modules/sizing";
import { FitProfileForm } from "@/modules/sizing/fit-profile-ui";

export default async function NewFitProfilePage() {
  let categories;
  try {
    categories = await listGarmentCategories();
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
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Fit profiles</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">New profile</h1>
      </div>
      <FitProfileForm
        profile={null}
        categories={categories.map((c) => ({
          id: c.id,
          key: c.key,
          name: c.name,
        }))}
        mode="create"
      />
    </div>
  );
}
