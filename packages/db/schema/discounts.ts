import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./identity";
import { orders } from "./orders";

export const discountTypeEnum = pgEnum("discount_type", [
  "PERCENTAGE",
  "FIXED_AMOUNT",
  "FREE_SHIPPING",
]);

export const discountAppliesToEnum = pgEnum("discount_applies_to", [
  "ORDER",
  "COLLECTION",
  "DESIGN",
  "GARMENT_TYPE",
]);

export const discountStatusEnum = pgEnum("discount_status", [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "EXPIRED",
]);

export const discounts = pgTable(
  "discounts",
  {
    id: uuid("id").primaryKey(),
    /** Null means automatic — applied without a code at checkout. */
    code: text("code"),
    name: text("name").notNull(),
    type: discountTypeEnum("type").notNull(),
    /** Percent 0–100, fixed amount in paisa, or 0 for free shipping. */
    value: integer("value").notNull(),
    appliesTo: discountAppliesToEnum("applies_to").notNull(),
    /** Design/garment-type UUIDs or collection slugs depending on appliesTo. */
    targetIds: text("target_ids").array().notNull().default([]),
    minSpendMinor: integer("min_spend_minor").notNull().default(0),
    maxDiscountMinor: integer("max_discount_minor"),
    firstOrderOnly: boolean("first_order_only").notNull().default(false),
    oncePerCustomer: boolean("once_per_customer").notNull().default(false),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    stackable: boolean("stackable").notNull().default(false),
    status: discountStatusEnum("status").notNull().default("DRAFT"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("discounts_code_uidx").on(t.code),
  ],
);

export const discountRedemptions = pgTable("discount_redemptions", {
  id: uuid("id").primaryKey(),
  discountId: uuid("discount_id")
    .notNull()
    .references(() => discounts.id, { onDelete: "restrict" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  guestEmail: text("guest_email"),
  amountMinor: integer("amount_minor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
