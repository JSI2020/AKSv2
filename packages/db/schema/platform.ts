import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./identity";

/** Append-only. Never expose update/delete paths. */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const outboxStatusEnum = pgEnum("outbox_status", [
  "PENDING",
  "SENT",
  "DEAD",
]);

export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey(),
  topic: text("topic").notNull(),
  payload: jsonb("payload").notNull(),
  status: outboxStatusEnum("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  availableAt: timestamp("available_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assetKindEnum = pgEnum("asset_kind", [
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "OTHER",
]);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey(),
  r2Key: text("r2_key").notNull(),
  mime: text("mime").notNull(),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes").notNull(),
  sha256: text("sha256").notNull(),
  kind: assetKindEnum("kind").notNull().default("OTHER"),
  uploadedById: uuid("uploaded_by_id").references(() => users.id),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  purgeAt: timestamp("purge_at", { withTimezone: true }),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
