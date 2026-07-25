import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import { StudioSettingsForm } from "@/modules/ai/studio/studio-settings-form";
import { getStudioSettingsFormData } from "@/modules/ai/studio/actions";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

export default async function StudioSettingsPage() {
  let data;
  try {
    data = await getStudioSettingsFormData();
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
        <Eyebrow>Settings · Studio</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          Studio defaults
        </h1>
        <p className="mt-1 max-w-xl text-[13px] text-chalk">
          Set once, edited rarely — archetype, backdrop, AI model placeholders,
          lead time, and active prompt template version.
        </p>
        <Link
          href="/admin/settings"
          className="mt-2 inline-block text-[12px] text-zari underline-offset-2 hover:underline"
        >
          ← All settings
        </Link>
      </div>
      <StudioSettingsForm {...data} />
    </div>
  );
}
