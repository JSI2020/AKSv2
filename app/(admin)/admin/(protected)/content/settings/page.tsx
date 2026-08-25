import Link from "next/link";

import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { SiteSettingsForm } from "@/modules/content/admin/site-settings-form";
import { getSiteSettings } from "@/modules/content/site-settings";

export default async function ContentSiteSettingsPage() {
  await requirePermission("settings.view");
  const initial = await getSiteSettings();

  return (
    <div>
      <Link
        href="/admin/content"
        className="font-sans text-[12px] text-ink/55 hover:text-zari"
      >
        ← Content & Settings
      </Link>
      <Eyebrow className="mt-4 text-ink/55">Content · Site settings</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-light text-ink">
        Site settings
      </h1>
      <p className="mt-2 max-w-xl text-[13px] text-ink/55">
        The facts repeated everywhere on the storefront — set once, correct
        everywhere.
      </p>
      <SiteSettingsForm initial={initial} />
    </div>
  );
}
