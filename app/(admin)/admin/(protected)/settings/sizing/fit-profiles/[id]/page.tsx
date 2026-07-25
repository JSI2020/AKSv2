import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getFitProfile } from "@/modules/sizing/fit-profile-actions";
import { FitProfileForm } from "@/modules/sizing/fit-profile-ui";

export default async function EditFitProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let profile;
  try {
    profile = await getFitProfile(id);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }
  if (!profile) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Fit profiles</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {profile.name}
        </h1>
      </div>
      <FitProfileForm profile={profile} categories={[]} mode="edit" />
    </div>
  );
}
