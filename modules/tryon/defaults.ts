import { eq } from "drizzle-orm";

import {
  db,
  TRYON_SETTINGS_SINGLETON_ID,
  tryonSettings,
} from "@aks/db";

import { VERIFIED_FAL_TRYON_MODEL } from "./types";

export type TryonSettingsRow = typeof tryonSettings.$inferSelect;

export async function ensureTryonSettingsRow(): Promise<TryonSettingsRow> {
  const existing = await db
    .select()
    .from(tryonSettings)
    .where(eq(tryonSettings.id, TRYON_SETTINGS_SINGLETON_ID))
    .limit(1);

  if (existing[0]) return existing[0];

  const [inserted] = await db
    .insert(tryonSettings)
    .values({
      id: TRYON_SETTINGS_SINGLETON_ID,
      enabled: true,
      modelId: VERIFIED_FAL_TRYON_MODEL,
      consentVersion: 1,
      anonDailyLimit: 3,
      signedInDailyLimit: 20,
    })
    .returning();

  if (!inserted) throw new Error("Failed to seed tryon_settings");
  return inserted;
}

export async function getTryonSettings(): Promise<TryonSettingsRow> {
  return ensureTryonSettingsRow();
}
