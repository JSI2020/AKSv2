import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./identity";

/** Extends users with role CUSTOMER — no parallel customer table. */
export const customerProfiles = pgTable("customer_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  whatsappNumber: text("whatsapp_number"),
  codRefusalCount: integer("cod_refusal_count").notNull().default(0),
  codDisabled: boolean("cod_disabled").notNull().default(false),
  totalOrdersCount: integer("total_orders_count").notNull().default(0),
  lifetimeValueMinor: integer("lifetime_value_minor").notNull().default(0),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  internalNotes: text("internal_notes"),
  acceptsMarketing: boolean("accepts_marketing").notNull().default(false),
  source: text("source"),
  /** Soft merge — loser points at survivor; never hard-deleted. */
  mergedIntoUserId: uuid("merged_into_user_id").references(() => users.id),
  mergedAt: timestamp("merged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
