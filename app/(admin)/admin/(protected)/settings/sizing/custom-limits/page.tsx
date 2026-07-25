import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listCustomSizeLimitsForAdmin } from "@/modules/measure";
import { CustomSizeLimitList } from "@/modules/sizing/custom-size-limit-ui";

export default async function CustomSizeLimitsPage() {
  let limits;
  try {
    limits = await listCustomSizeLimitsForAdmin();
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
            Custom size limits
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-chalk">
            Min, max, and step for made-to-measure — plus cross-field plausibility
            rules.
          </p>
        </div>
        <Link
          href="/admin/settings/sizing/custom-limits/new"
          className="border border-zari px-3 py-1.5 text-[13px] text-zari"
        >
          New limit
        </Link>
      </div>
      <CustomSizeLimitList limits={limits} />
    </div>
  );
}
