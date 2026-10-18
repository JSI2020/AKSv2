import "server-only";

import { and, eq, sql } from "drizzle-orm";

import {
  db,
  insertAuditLog,
  WHATSAPP_CONNECTION_ID,
  whatsappConnections,
  whatsappSyncedContacts,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { encryptSecret } from "@/modules/auth/encryption";
import { publicSiteOrigin } from "@/modules/legal/routes";

import {
  fetchWhatsappPhoneProfile,
  exchangeEmbeddedSignupCode,
  subscribeAppToWaba,
  subscribeWhatsappWebhookFields,
  syncWhatsappBusinessAppData,
} from "./providers/whatsapp-graph";
import {
  HOUSE_WHATSAPP_WABA_ID,
  isMetaId,
  summarizeWhatsappWebhook,
  whatsappEmbeddedAppId,
  whatsappEmbeddedAppSecret,
  whatsappGraphVersion,
  type SyncedContact,
} from "./whatsapp-coexistence-parse";

export type WhatsappConnectionView = {
  appId: string;
  configId: string | null;
  appSecretConfigured: boolean;
  status: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  contactsSync: string;
  historySync: string;
  contactsSyncDetail: string | null;
  historySyncDetail: string | null;
  contactsReceived: number;
  historyMessagesReceived: number;
  lastError: string | null;
  connectedAt: string | null;
  houseWaba: boolean;
  phoneSource: "connected" | "env";
  envPhoneNumberId: string | null;
};

async function ensureRow(appId: string): Promise<void> {
  await db
    .insert(whatsappConnections)
    .values({
      id: WHATSAPP_CONNECTION_ID,
      appId,
      status: "PENDING",
    })
    .onConflictDoNothing();
}

export async function loadWhatsappConnectionView(): Promise<WhatsappConnectionView> {
  const appId = whatsappEmbeddedAppId();
  const envConfig = process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim() || null;
  let row: typeof whatsappConnections.$inferSelect | undefined;
  try {
    await ensureRow(appId);
    const [found] = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.id, WHATSAPP_CONNECTION_ID))
      .limit(1);
    row = found;
  } catch {
    row = undefined;
  }
  const configId = row?.configId || (isMetaId(envConfig) ? envConfig : null);
  const connected = row?.status === "CONNECTED" && Boolean(row.phoneNumberId);
  return {
    appId,
    configId,
    appSecretConfigured: Boolean(whatsappEmbeddedAppSecret()),
    status: row?.status ?? "PENDING",
    wabaId: row?.wabaId ?? null,
    phoneNumberId: row?.phoneNumberId ?? null,
    displayPhoneNumber: row?.displayPhoneNumber ?? null,
    verifiedName: row?.verifiedName ?? null,
    contactsSync: row?.contactsSync ?? "not_started",
    historySync: row?.historySync ?? "not_started",
    contactsSyncDetail: row?.contactsSyncDetail ?? null,
    historySyncDetail: row?.historySyncDetail ?? null,
    contactsReceived: row?.contactsReceived ?? 0,
    historyMessagesReceived: row?.historyMessagesReceived ?? 0,
    lastError: row?.lastError ?? null,
    connectedAt: row?.connectedAt ? row.connectedAt.toISOString() : null,
    houseWaba: row?.wabaId === HOUSE_WHATSAPP_WABA_ID,
    phoneSource: connected ? "connected" : "env",
    envPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
  };
}

export async function saveWhatsappConfigId(configId: string): Promise<void> {
  const appId = whatsappEmbeddedAppId();
  await ensureRow(appId);
  await db
    .update(whatsappConnections)
    .set({ configId, appId, updatedAt: new Date() })
    .where(eq(whatsappConnections.id, WHATSAPP_CONNECTION_ID));
}

function clip(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

export async function completeWhatsappCoexistence(input: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  actorId: string;
  actorRole: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const appSecret = whatsappEmbeddedAppSecret();
  if (!appSecret) {
    return {
      ok: false,
      error: "WHATSAPP_APP_SECRET is not set for the AKS Atelier Meta app.",
    };
  }
  if (!isMetaId(input.wabaId) || !isMetaId(input.phoneNumberId)) {
    return { ok: false, error: "WhatsApp did not return a phone number id." };
  }
  const code = input.code.trim();
  if (code.length < 8 || code.length > 512) {
    return { ok: false, error: "The signup code was missing." };
  }

  const appId = whatsappEmbeddedAppId();
  const version = whatsappGraphVersion();
  await ensureRow(appId);

  const exchanged = await exchangeEmbeddedSignupCode({
    appId,
    appSecret,
    code,
    version,
  });
  if (!exchanged.ok) {
    await db
      .update(whatsappConnections)
      .set({
        status: "ERROR",
        lastError: clip(exchanged.error),
        updatedAt: new Date(),
      })
      .where(eq(whatsappConnections.id, WHATSAPP_CONNECTION_ID));
    return { ok: false, error: "Could not exchange the signup code." };
  }

  const profile = await fetchWhatsappPhoneProfile({
    phoneNumberId: input.phoneNumberId,
    token: exchanged.token,
    version,
  });
  const subscribed = await subscribeAppToWaba({
    wabaId: input.wabaId,
    token: exchanged.token,
    version,
  });
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || "";
  let webhookNote: string | null = null;
  if (verifyToken) {
    const fields = await subscribeWhatsappWebhookFields({
      appId,
      appSecret,
      version,
      callbackUrl: `${publicSiteOrigin()}/api/webhooks/whatsapp`,
      verifyToken,
    });
    if (!fields.ok) webhookNote = clip(fields.error);
  }

  const contacts = await syncWhatsappBusinessAppData({
    phoneNumberId: input.phoneNumberId,
    token: exchanged.token,
    version,
    syncType: "smb_app_state_sync",
  });
  const history = await syncWhatsappBusinessAppData({
    phoneNumberId: input.phoneNumberId,
    token: exchanged.token,
    version,
    syncType: "history",
  });

  let encrypted: string;
  try {
    encrypted = encryptSecret(exchanged.token);
  } catch {
    return {
      ok: false,
      error: "Could not store the WhatsApp token. The encryption key is missing.",
    };
  }

  const now = new Date();
  const houseNote =
    input.wabaId === HOUSE_WHATSAPP_WABA_ID
      ? null
      : `Linked WABA ${input.wabaId}, not the house WABA.`;
  const lastError = [houseNote, webhookNote].filter(Boolean).join(" ") || null;

  await db
    .update(whatsappConnections)
    .set({
      status: subscribed.ok ? "CONNECTED" : "ERROR",
      appId,
      wabaId: input.wabaId,
      phoneNumberId: subscribed.ok ? input.phoneNumberId : null,
      displayPhoneNumber: profile.displayPhoneNumber,
      verifiedName: profile.verifiedName,
      businessTokenEncrypted: encrypted,
      contactsSync: contacts.ok ? "requested" : "error",
      historySync: history.ok ? "requested" : "not_offered",
      contactsSyncDetail: contacts.ok ? null : clip(contacts.error),
      historySyncDetail: history.ok ? null : clip(history.error),
      lastError: subscribed.ok ? lastError : clip(subscribed.error),
      connectedAt: subscribed.ok ? now : null,
      updatedAt: now,
    })
    .where(eq(whatsappConnections.id, WHATSAPP_CONNECTION_ID));

  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "whatsapp.coexistence.connect",
    entityType: "whatsapp_connection",
    entityId: WHATSAPP_CONNECTION_ID,
    after: {
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      subscribed: subscribed.ok,
      contactsSync: contacts.ok ? "requested" : "error",
      historySync: history.ok ? "requested" : "not_offered",
    },
  });

  if (!subscribed.ok) {
    return {
      ok: false,
      error: "The number was authorised, but webhook subscription failed.",
    };
  }
  return { ok: true };
}

async function applyContacts(contacts: SyncedContact[]): Promise<number> {
  let applied = 0;
  for (const contact of contacts) {
    if (contact.action === "remove") {
      await db
        .delete(whatsappSyncedContacts)
        .where(
          and(
            eq(whatsappSyncedContacts.connectionId, WHATSAPP_CONNECTION_ID),
            eq(whatsappSyncedContacts.waId, contact.waId),
          ),
        );
      continue;
    }
    await db
      .insert(whatsappSyncedContacts)
      .values({
        id: uuidv7(),
        connectionId: WHATSAPP_CONNECTION_ID,
        waId: contact.waId,
        fullName: contact.fullName,
        action: "add",
      })
      .onConflictDoUpdate({
        target: [whatsappSyncedContacts.connectionId, whatsappSyncedContacts.waId],
        set: {
          fullName: contact.fullName,
          action: "add",
          syncedAt: new Date(),
        },
      });
    applied += 1;
  }
  return applied;
}

/** Store coexistence webhook progress. Message bodies are discarded. */
export async function ingestWhatsappCoexistenceWebhook(
  body: unknown,
): Promise<void> {
  const summary = summarizeWhatsappWebhook(body);
  if (
    summary.contacts.length === 0 &&
    summary.historyMessages === 0 &&
    summary.historyProgress === null &&
    !summary.historyDeclined
  ) {
    return;
  }
  await ensureRow(whatsappEmbeddedAppId());
  const applied = await applyContacts(summary.contacts);
  const now = new Date();
  await db
    .update(whatsappConnections)
    .set({
      contactsReceived: sql`${whatsappConnections.contactsReceived} + ${applied}`,
      historyMessagesReceived: sql`${whatsappConnections.historyMessagesReceived} + ${summary.historyMessages}`,
      ...(summary.contacts.length > 0 ? { contactsSync: "receiving" } : {}),
      ...(summary.historyDeclined
        ? {
            historySync: "not_offered",
            historySyncDetail: "History sharing was not offered",
          }
        : summary.historyMessages > 0 || summary.historyProgress !== null
          ? {
              historySync: "receiving",
              historySyncDetail:
                summary.historyProgress !== null
                  ? `Progress ${summary.historyProgress}`
                  : null,
            }
          : {}),
      updatedAt: now,
    })
    .where(eq(whatsappConnections.id, WHATSAPP_CONNECTION_ID));
}
