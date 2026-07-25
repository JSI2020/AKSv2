import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { orders } from "./orders";

export const messageChannelEnum = pgEnum("message_channel", ["EMAIL"]);

export const messageLogStatusEnum = pgEnum("message_log_status", [
  "PENDING",
  "SENT",
  "FAILED",
  "DEAD",
]);

export const messageTemplates = pgTable("message_templates", {
  id: uuid("id").primaryKey(),
  key: text("key").notNull(),
  channel: messageChannelEnum("channel").notNull().default("EMAIL"),
  locale: text("locale").notNull().default("en"),
  version: integer("version").notNull().default(1),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messageLog = pgTable("message_log", {
  id: uuid("id").primaryKey(),
  recipient: text("recipient").notNull(),
  templateKey: text("template_key").notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  status: messageLogStatusEnum("status").notNull().default("PENDING"),
  providerRef: text("provider_ref"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  error: text("error"),
  outboxId: uuid("outbox_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
