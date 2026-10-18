import "server-only";

import { eq } from "drizzle-orm";

import { db, siteSettings } from "@aks/db";

import {
  DEFAULT_SITE_SETTINGS,
  type SiteSettingsPublic,
} from "./types";

const KEY = "storefront";

/** Old seed / admin values that mis-state RTW lead time. */
const STALE_LEAD_TIME_PROMISES = [
  "made when you order",
  "3–5 day",
  "3-5 day",
  "ships in 3–5",
  "ships in 3-5",
  "dispatched in 3–5",
  "dispatched in 3-5",
  "typically 14–21",
  "typically 14-21",
];

function scrubSiteSettings(raw: Partial<SiteSettingsPublic>): SiteSettingsPublic {
  const merged: SiteSettingsPublic = {
    ...DEFAULT_SITE_SETTINGS,
    ...raw,
  };
  const promise = merged.leadTimePromise?.trim() ?? "";
  const stale = STALE_LEAD_TIME_PROMISES.some((needle) =>
    promise.toLowerCase().includes(needle.toLowerCase()),
  );
  if (!promise || stale) {
    merged.leadTimePromise = DEFAULT_SITE_SETTINGS.leadTimePromise;
  }
  if (
    merged.shippingMode !== "FREE_PAKISTAN" &&
    merged.shippingMode !== "FLAT_PAKISTAN"
  ) {
    merged.shippingMode = DEFAULT_SITE_SETTINGS.shippingMode;
  }
  merged.shippingFlatMinor = Math.max(
    0,
    Math.trunc(Number(merged.shippingFlatMinor) || 0),
  );
  if (!merged.shippingPromise?.trim()) {
    merged.shippingPromise = DEFAULT_SITE_SETTINGS.shippingPromise;
  }
  return merged;
}

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

  return scrubSiteSettings(raw as Partial<SiteSettingsPublic>);
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

const STALE_PREPARED_BANNER =
  /white collection and house doors are being prepared|coming soon\s*[—–-]\s*the white collection/i;

/**
 * The ticker must not say the house is still being prepared while the
 * lead-time promise says pieces ship. Any other banner the owner writes
 * is left as they saved it.
 */
export function alignBannerWithLeadTime(
  message: string,
  settings: SiteSettingsPublic,
): string {
  const trimmed = message.trim();
  if (!trimmed || !STALE_PREPARED_BANNER.test(trimmed)) return trimmed;
  const lead = formatLeadTimeLine(settings, null);
  if (/ship/i.test(lead)) return lead;
  const min = settings.leadTimeDaysMin;
  const max = settings.leadTimeDaysMax;
  if (min > 0 && max >= min) {
    return `Ready to wear · ships in ${min}–${max} days`;
  }
  return "Ready to wear · ships in 14–18 days";
}

/** Lead-time line for PDP / cart — prefers override days, else global promise. */
export function formatLeadTimeLine(
  settings: SiteSettingsPublic,
  daysOverride: number | null,
): string {
  if (daysOverride != null && daysOverride > 0) {
    return `Ready to wear · ships in about ${daysOverride} days`;
  }
  const promise = settings.leadTimePromise?.trim();
  if (promise) return promise;
  const min = settings.leadTimeDaysMin;
  const max = settings.leadTimeDaysMax;
  if (min > 0 && max > 0 && max >= min) {
    return `Ready to wear · typically ${min}–${max} days`;
  }
  return "Ready to wear · timing depends on the piece";
}
