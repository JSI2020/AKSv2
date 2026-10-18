import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** One row. The connected Cloud API number overrides WHATSAPP_PHONE_NUMBER_ID. */
export const WHATSAPP_CONNECTION_ID = "01900000-0000-7000-8000-0000000000aa";

export const whatsappConnections = pgTable("whatsapp_connections", {
  id: uuid("id").primaryKey(),
  status: text("status").notNull().default("PENDING"),
  appId: text("app_id").notNull(),
  configId: text("config_id"),
  wabaId: text("waba_id"),
  phoneNumberId: text("phone_number_id"),
  displayPhoneNumber: text("display_phone_number"),
  verifiedName: text("verified_name"),
  /** Embedded Signup business token. The .env system-user token stays the fallback. */
  businessTokenEncrypted: text("business_token_encrypted"),
  contactsSync: text("contacts_sync").notNull().default("not_started"),
  historySync: text("history_sync").notNull().default("not_started"),
  contactsSyncDetail: text("contacts_sync_detail"),
  historySyncDetail: text("history_sync_detail"),
  contactsReceived: integer("contacts_received").notNull().default(0),
  historyMessagesReceived: integer("history_messages_received")
    .notNull()
    .default(0),
  lastError: text("last_error"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const whatsappSyncedContacts = pgTable(
  "whatsapp_synced_contacts",
  {
    id: uuid("id").primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => whatsappConnections.id, { onDelete: "cascade" }),
    waId: text("wa_id").notNull(),
    fullName: text("full_name"),
    action: text("action").notNull().default("add"),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("whatsapp_synced_contacts_connection_wa_uidx").on(
      t.connectionId,
      t.waId,
    ),
  ],
);
