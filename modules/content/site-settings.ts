import "server-only";

import { eq } from "drizzle-orm";

import { db, siteSettings } from "@aks/db";

import {
  DEFAULT_SITE_SETTINGS,
  type SiteSettingsPublic,
} from "./types";

const KEY = "storefront";

export async function getSiteSettings(): Promise<SiteSettingsPublic> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, KEY))
    .limit(1);

  const raw = rows[0]?.value;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SITE_SETTINGS };
  }

  return {
    ...DEFAULT_SITE_SETTINGS,
    ...(raw as Partial<SiteSettingsPublic>),
  };
}

export async function upsertSiteSettings(
  value: SiteSettingsPublic,
): Promise<void> {
  const existing = await db
    .select({ key: siteSettings.key })
    .from(siteSettings)
    .where(eq(siteSettings.key, KEY))
    .limit(1);

  if (existing[0]) {
    await db
      .update(siteSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(siteSettings.key, KEY));
  } else {
    await db.insert(siteSettings).values({ key: KEY, value });
  }
}

/** Lead-time line for PDP / cart — prefers override days, else global promise. */
export function formatLeadTimeLine(
  settings: SiteSettingsPublic,
  daysOverride: number | null,
): string {
  if (daysOverride != null) {
    return `Made when you order · ${daysOverride} days`;
  }
  return settings.leadTimePromise;
}
