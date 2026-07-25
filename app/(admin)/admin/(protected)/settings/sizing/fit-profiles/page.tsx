import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listFitProfiles } from "@/modules/sizing/fit-profile-actions";
import { FitProfileList } from "@/modules/sizing/fit-profile-ui";

export default async function FitProfilesPage() {
  let profiles;
  try {
    profiles = await listFitProfiles();
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Settings · Sizing</Eyebrow>
          <h1 className="mt-1 font-display text-3xl text-greige">
            Fit profiles
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-chalk">
            Ease per silhouette — same body chart, different finished garments.
          </p>
        </div>
        <Link
          href="/admin/settings/sizing/fit-profiles/new"
          className="border border-zari px-3 py-1.5 text-[13px] text-zari"
        >
          New profile
        </Link>
      </div>
      <FitProfileList profiles={profiles} />
    </div>
  );
}
